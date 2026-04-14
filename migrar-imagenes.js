// Script para subir imágenes locales a Cloudinary
// Ejecutar con: node migrar-imagenes.js

const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

cloudinary.config({
  cloud_name: "dsizydbkc",
  api_key:    "569919151826384",
  api_secret: "gQxyt8KdpnGFrVD_etY8Q-CtRCw"
});

const uploadsDir = path.join(__dirname, "uploads");
const files = fs.readdirSync(uploadsDir);

async function migrar() {
  console.log("Subiendo", files.length, "imágenes a Cloudinary...\n");
  const resultados = {};

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const publicId = path.parse(file).name; // nombre sin extensión

    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: "uanl-explora/seed",
        public_id: publicId,
        overwrite: true
      });
      resultados[file] = result.secure_url;
      console.log("✓", file, "→", result.secure_url);
    } catch (err) {
      console.error("✗", file, "→ ERROR:", err.message);
    }
  }

  console.log("\n--- RESULTADO FINAL ---");
  console.log(JSON.stringify(resultados, null, 2));
}

migrar();
