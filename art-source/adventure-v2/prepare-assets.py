"""Prepare requested game PNGs from original built-in generated source PNGs.

The generator rendered a neutral checkerboard instead of alpha. This script
uses the user's authorized algorithmic transparency cleanup, preserves the
source images, and repacks the atlas cells with generous transparent padding.
"""
from collections import deque
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageDraw

BASE = Path(__file__).resolve().parent
NAMES = ["traversal-stone-v2", "traversal-lab-v2", "mech-explosion-v2", "mech-wreck-v2"]


def components(mask):
    """Connected regions, sufficient for removing tiny generated matte specks."""
    seen = np.zeros(mask.shape, bool)
    height, width = mask.shape
    for sy, sx in zip(*np.where(mask)):
        if seen[sy, sx]:
            continue
        queue = deque([(sy, sx)])
        seen[sy, sx] = True
        region = []
        while queue:
            y, x = queue.popleft()
            region.append((y, x))
            for ny, nx in ((y-1,x), (y+1,x), (y,x-1), (y,x+1)):
                if 0 <= ny < height and 0 <= nx < width and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx] = True
                    queue.append((ny,nx))
        yield region


def clean_alpha(source, name):
    rgb = np.asarray(source.convert("RGB"), dtype=np.float32)
    chroma = rgb.max(2)-rgb.min(2)
    luma = rgb.mean(2)
    low = 157 if name in ("traversal-stone-v2", "mech-wreck-v2") else 88
    color_alpha = np.clip((chroma-9)/13, 0, 1)
    dark_alpha = np.clip((low+18-luma)/18, 0, 1)
    alpha = np.maximum(color_alpha, dark_alpha)
    is_effect = name == "mech-explosion-v2"
    if is_effect:
        # White-hot centers are foreground even though they have no chroma.
        alpha = np.maximum.reduce([
            np.clip((chroma-13)/38,0,1),
            np.clip((110-luma)/35,0,1),
            np.clip((luma-238)/10,0,1),
        ])
    solid = alpha > 0.22
    # Seal only narrow threshold pinholes, preserving bridge/lift openings.
    closed = np.asarray(Image.fromarray((solid*255).astype("uint8")).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))) > 127
    for region in components(~closed):
        if len(region) <= 230:
            yy, xx = zip(*region)
            if min(yy) > 0 and min(xx) > 0 and max(yy) < solid.shape[0]-1 and max(xx) < solid.shape[1]-1:
                closed[yy,xx] = True
    minimum = 6 if name == "mech-explosion-v2" else 35
    for region in components(closed):
        if len(region) < minimum:
            yy, xx = zip(*region)
            closed[yy,xx] = False
    # The original solid surfaces stay opaque; only their antialias fringe is soft.
    core = np.asarray(Image.fromarray((closed*255).astype("uint8")).filter(ImageFilter.MinFilter(3))) > 127
    alpha = np.where(closed, np.maximum(alpha, 0.2), 0)
    if is_effect:
        alpha[core & ((chroma>58)|(luma<90)|(luma>246))] = 1
        # Remove neutral checkerboard contamination from translucent fringes.
        edge = (alpha>0)&(alpha<0.97)
        neutral = rgb.min(2)
        fringe_rgb = (rgb-neutral[...,None])/np.maximum(alpha[...,None],0.08) + 55
        rgb[edge] = np.clip(fringe_rgb[edge],0,255)
    else:
        alpha[core] = 1
    alpha = (alpha*255).astype("uint8")
    result = Image.fromarray(np.clip(rgb,0,255).astype("uint8")).convert("RGBA")
    result.putalpha(Image.fromarray(alpha))
    return result


def pack_cells(source, name):
    width, height = source.size
    boxes = [(0,0,width,height)] if name == "mech-wreck-v2" else [
        (0,0,width//2,height//2), (width//2,0,width,height//2),
        (0,height//2,width//2,height), (width//2,height//2,width,height),
    ]
    cells = [clean_alpha(source.crop(box), name) for box in boxes]
    bounds = [cell.getbbox() for cell in cells]
    if len(cells) == 1:
        output = Image.new("RGBA", (1536,768))
        crop = cells[0].crop(bounds[0])
        crop.thumbnail((1152,576), Image.Resampling.LANCZOS)
        output.alpha_composite(crop, ((1536-crop.width)//2,(768-crop.height)//2))
        return output, boxes
    output = Image.new("RGBA", (1280,1280))
    sizes = [(bbox[2]-bbox[0], bbox[3]-bbox[1]) for bbox in bounds]
    common_scale = min(468/max(w for w,h in sizes),468/max(h for w,h in sizes))
    for index, (cell,bbox) in enumerate(zip(cells,bounds)):
        crop = cell.crop(bbox)
        scale = common_scale if name == "mech-explosion-v2" else min(468/crop.width,468/crop.height)
        crop = crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
        x = (index%2)*640 + (640-crop.width)//2
        y = (index//2)*640 + (640-crop.height)//2
        output.alpha_composite(crop,(x,y))
    return output, boxes


report = {"mode":"built-in image_gen; algorithmic neutral-checkerboard removal and cell padding", "assets":[]}
qa = Image.new("RGB",(1536,1450),"#18323b")
draw = ImageDraw.Draw(qa)
for index,name in enumerate(NAMES):
    source = Image.open(BASE/f"{name}-source.png")
    final, source_boxes = pack_cells(source,name)
    final.save(BASE/f"{name}.png")
    alpha = np.asarray(final.getchannel("A"))
    entry = {"file":f"{name}.png", "source_file":f"{name}-source.png", "source_size":list(source.size),
             "source_mode":source.mode,"size":list(final.size),"mode":final.mode,
             "transparent_pixels":int((alpha==0).sum()),"partial_alpha_pixels":int(((alpha>0)&(alpha<255)).sum()),
             "alpha_extrema":list(final.getchannel("A").getextrema()),"source_cells":source_boxes}
    if name != "mech-wreck-v2":
        entry["grid"]=[2,2]
        entry["cell_size"]=[640,640]
        entry["cell_bounds"]=[final.crop((x*640,y*640,(x+1)*640,(y+1)*640)).getbbox() for y in range(2) for x in range(2)]
    else:
        entry["grid"]=[1,1]
        entry["bounds"]=final.getbbox()
    report["assets"].append(entry)
    preview=final.copy()
    preview.thumbnail((740,650),Image.Resampling.LANCZOS)
    px=(index%2)*768+(768-preview.width)//2
    py=(index//2)*720+45+(650-preview.height)//2
    qa.paste(preview,(px,py),preview)
    draw.text(((index%2)*768+25,(index//2)*720+18),name,fill="white")
qa.save(BASE/"transparency-qa.png")
(BASE/"asset-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(report,ensure_ascii=False,indent=2))
