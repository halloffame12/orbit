// Wraps build/icon.png into a Windows .ico on disk (PNG-in-ICO format).
const fs = require("fs");
const path = require("path");

const buildDir = path.join(__dirname, "..", "build");
const pngPath = path.join(buildDir, "icon.png");
const icoPath = path.join(buildDir, "icon.ico");

if (!fs.existsSync(pngPath)) {
  console.error("build/icon.png not found — run `npm run icon` after make-icon.ps1 or generate a 256x256 PNG.");
  process.exit(1);
}

const png = fs.readFileSync(pngPath);

// ICONDIR: reserved(2) type(2) count(2)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count: 1 image

// ICONDIRENTRY: width(1) height(1) colors(1) reserved(1) planes(2) bpp(2) size(4) offset(4)
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // 0 means 256
entry.writeUInt8(0, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bpp
entry.writeUInt32LE(png.length, 8); // bytesInRes
entry.writeUInt32LE(6 + 16, 12); // imageOffset

fs.writeFileSync(icoPath, Buffer.concat([header, entry, png]));
console.log(`Wrote ${icoPath} (${png.length} bytes PNG payload)`);