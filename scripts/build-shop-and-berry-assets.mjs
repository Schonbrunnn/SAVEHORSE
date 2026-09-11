import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('public/game/assets/berry-v1', { recursive: true });
await mkdir('public/game/assets/shop-v1', { recursive: true });
for (const pose of ['hover', 'attack', 'rest']) {
  await sharp(`art-source/berry-v1/${pose}.png`).trim({ threshold: 10 })
    .resize({ height: 480, withoutEnlargement: true })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 91, alphaQuality: 100 }).toFile(`public/game/assets/berry-v1/${pose}.webp`);
}

// Mask the exact supplied sitting figure: preserve every face pixel, no redraw.
const source = 'art-source/shop-v1/quan-reference.png';
// The reference's lower legs are already hidden by the counter/items. Fade
// only that occluded lower edge; do not invent missing body or alter the face.
const merchantMask = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941"><defs><linearGradient id="hem" x1="0" y1="590" x2="0" y2="646" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><path fill="url(#hem)" d="M816 652 Q832 644 841 613 Q852 580 875 550 Q888 530 908 516 L909 498 Q942 474 971 449 Q990 423 1005 412 L1020 406 Q1006 387 1011 378 L1047 329 Q1074 287 1116 264 Q1124 260 1133 266 Q1157 279 1171 292 Q1177 310 1184 340 Q1190 367 1213 395 Q1218 405 1208 414 L1201 417 Q1218 420 1218 429 Q1235 442 1257 492 L1260 499 L1283 515 Q1293 538 1295 559 Q1313 575 1316 603 Q1313 632 1305 645 L1318 655 Z"/></svg>');
const merchant = await sharp(source).composite([{ input: merchantMask, blend: 'dest-in' }]).png().toBuffer();
await sharp(merchant).extract({ left: 802, top: 248, width: 544, height: 416 }).webp({ quality: 96, alphaQuality: 100 }).toFile('public/game/assets/shop-v1/quan-seated.webp');

// Item illustrations come from the same user-supplied sheet; exclude labels.
const items = {
  heal: 'M634 639 Q648 635 666 640 L663 655 Q672 657 670 665 L664 669 L664 681 Q690 691 687 718 Q687 744 673 751 Q646 760 625 749 Q614 741 612 716 Q610 694 632 683 L633 669 Q626 669 628 660 L635 657 Z',
  max: 'M803 693 Q788 685 780 693 Q767 700 771 720 Q775 742 793 750 Q808 759 815 753 Q831 760 841 746 Q854 732 853 708 Q852 689 832 687 Q818 687 808 695 Z M807 695 Q806 678 801 670 L797 668 L802 665 Q808 676 809 687 Z M809 677 Q810 659 824 652 L848 647 Q839 671 812 673 Z M798 678 Q782 658 759 689 Q780 687 796 681 Z',
  badfruit: 'M944 699 Q949 688 969 685 L978 685 L978 679 L987 682 L992 680 L995 673 Q1001 673 1002 683 L1008 687 L1023 682 Q1029 681 1028 687 L1022 694 L1033 700 L1032 704 L1025 707 L1037 717 L1027 721 L1032 733 L1026 735 Q1030 748 1020 752 Q1000 761 981 756 Q963 760 950 749 L943 754 L939 751 L943 746 Q939 741 940 733 Q935 726 939 717 Q935 708 942 704 Z',
  hurt: 'M1163 646 Q1178 641 1191 646 L1189 660 Q1197 661 1197 666 L1195 672 L1190 673 L1190 681 Q1193 687 1203 692 Q1218 705 1213 730 Q1210 752 1200 758 Q1175 765 1153 756 Q1141 752 1138 729 Q1134 706 1148 695 L1162 686 L1165 674 Q1158 673 1157 667 Q1158 662 1165 662 Z',
  knife: 'M1306 745 L1383 667 L1412 647 L1394 689 L1338 754 L1320 766 Z',
};
for (const [id, d] of Object.entries(items)) {
  const mask = Buffer.from(`<svg width="1672" height="941"><path fill="white" d="${d}"/></svg>`);
  const masked = await sharp(source).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  await sharp(masked).trim().resize({ width: 164, height: 164, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94, alphaQuality: 100 }).toFile(`public/game/assets/shop-v1/${id}.webp`);
}

// Remove the generated hand's diffuse background halo using an edge mask.
const handMask = Buffer.from('<svg width="1024" height="1536"><path fill="white" d="M328 92 Q486 46 655 94 L650 189 L650 314 L652 431 L668 549 Q690 609 722 656 L757 716 Q782 753 789 815 L801 902 Q802 943 772 982 Q755 1015 727 1032 Q696 1040 685 1011 L650 964 L645 1050 L641 1178 L637 1325 Q635 1370 607 1380 Q566 1391 553 1353 L545 1238 L539 1071 Q520 1100 486 1081 Q457 1076 440 1047 Q410 1055 383 1027 L367 976 Q329 972 309 944 L283 885 Q259 835 279 785 L303 731 L318 662 L344 588 L366 532 L361 449 L358 343 L344 230 Z"/></svg>');
const hand = await sharp('art-source/shop-v1/hand.png').composite([{ input: handMask, blend: 'dest-in' }]).png().toBuffer();
await sharp(hand).trim().resize({ height: 520 }).extend({ top: 2, bottom: 2, left: 2, right: 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 92, alphaQuality: 100 }).toFile('public/game/assets/shop-v1/hand.webp');
console.log('Built berry poses, exact-reference seated Quan, five items and flesh-tone pointer.');
