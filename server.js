const express    = require("express");
const mysql      = require("mysql2/promise");
const cors       = require("cors");
const multer     = require("multer");
const cloudinary = require("cloudinary").v2;
const { Readable } = require("stream");

const app = express();
app.use(cors());
app.use(express.json());

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dsizydbkc",
  api_key:    process.env.CLOUDINARY_API_KEY    || "569919151826384",
  api_secret: process.env.CLOUDINARY_API_SECRET || "gQxyt8KdpnGFrVD_etY8Q-CtRCw"
});

// Multer en memoria (no guarda en disco)
const upload = multer({ storage: multer.memoryStorage() });

// Helper: sube buffer a Cloudinary y retorna la URL segura
function subirACloudinary(buffer, folder) {
  return new Promise(function(resolve, reject) {
    var stream = cloudinary.uploader.upload_stream(
      { folder: folder || "uanl-explora" },
      function(err, result) {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

const db = mysql.createPool({
  host:     process.env.DB_HOST     || "metro.proxy.rlwy.net",
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "FmTpWTxXGlzPuWjHThqhzUvcwHQIkUNjx",
  database: process.env.DB_NAME     || "railway",
  port:     parseInt(process.env.DB_PORT) || 40965,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection()
  .then(conn => { console.log("MySQL conectado"); conn.release(); })
  .catch(err => console.log("Error MySQL:", err.message));

// ─── RUTAS ───────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.send("Servidor funcionando 🚀");
});

// LUGARES
app.get("/lugares", async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM lugares");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/lugares", upload.single("foto"), async (req, res) => {
  const { nombre, categoria, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });
  try {
    var fotoUrl = null;
    if (req.file) fotoUrl = await subirACloudinary(req.file.buffer, "uanl-explora/lugares");
    const [result] = await db.query(
      "INSERT INTO lugares (nombre, categoria, descripcion, imagen) VALUES (?, ?, ?, ?)",
      [nombre, categoria || null, descripcion || null, fotoUrl]
    );
    res.json({ id: result.insertId, nombre, categoria, descripcion, foto: fotoUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// RESEÑAS
app.post("/resenas", async (req, res) => {
  const { usuario_id, lugar_id, lugar_id_str, comentario, calificacion } = req.body;
  try {
    await db.query(
      "INSERT INTO resenas (usuario_id, lugar_id, lugar_id_str, comentario, calificacion) VALUES (?, ?, ?, ?, ?)",
      [usuario_id, lugar_id, lugar_id_str || null, comentario, calificacion]
    );
    res.json({ mensaje: "Reseña guardada" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/resenas", async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM resenas");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// REGISTRO
app.post("/registro", upload.single("foto"), async (req, res) => {
  const { nombre, apellido, usuario, password } = req.body;
  if (!nombre || !apellido || !usuario || !password) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  try {
    const [rows] = await db.query("SELECT id FROM usuarios WHERE usuario = ?", [usuario]);
    if (rows.length > 0) return res.status(409).json({ error: "Ese nombre de usuario ya está en uso" });

    var fotoUrl = null;
    if (req.file) fotoUrl = await subirACloudinary(req.file.buffer, "uanl-explora/perfiles");

    const [result] = await db.query(
      "INSERT INTO usuarios (nombre, apellido, usuario, password, foto) VALUES (?, ?, ?, ?, ?)",
      [nombre, apellido, usuario, password, fotoUrl]
    );
    res.json({ id: result.insertId, nombre, apellido, usuario, foto: fotoUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// LOGIN
app.post("/login", async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: "Faltan campos" });
  try {
    const [rows] = await db.query(
      "SELECT id, nombre, apellido, usuario, foto FROM usuarios WHERE usuario = ? AND password = ?",
      [usuario, password]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// NEGOCIOS
app.get("/negocios", async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM negocios ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/negocios", upload.single("foto"), async (req, res) => {
  const { usuario_id, nombre, categoria, descripcion, dias, horario, ubicacion } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });
  try {
    var fotoUrl = null;
    if (req.file) fotoUrl = await subirACloudinary(req.file.buffer, "uanl-explora/negocios");
    const [result] = await db.query(
      "INSERT INTO negocios (usuario_id, nombre, categoria, descripcion, dias, horario, ubicacion, foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [usuario_id || null, nombre, categoria || null, descripcion || null,
       dias || null, horario || null, ubicacion || null, fotoUrl]
    );
    res.json({ id: result.insertId, nombre, categoria, descripcion, dias, horario, ubicacion, foto: fotoUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/negocios/:id/foto", upload.single("foto"), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: "Se requiere una foto" });
  try {
    var fotoUrl = await subirACloudinary(req.file.buffer, "uanl-explora/negocios");
    await db.query("UPDATE negocios SET foto = ? WHERE id = ?", [fotoUrl, id]);
    res.json({ foto: fotoUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/negocios/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM negocios WHERE id = ?", [req.params.id]);
    res.json({ mensaje: "Negocio eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// MIS RESEÑAS
app.get("/mis-resenas/:usuario_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, l.nombre AS lugar_nombre, l.categoria
       FROM resenas r
       LEFT JOIN lugares l ON r.lugar_id = l.id
       WHERE r.usuario_id = ?
       ORDER BY r.id DESC`,
      [req.params.usuario_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ELIMINAR RESEÑA
app.delete("/resenas/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM resenas WHERE id = ?", [req.params.id]);
    res.json({ mensaje: "Reseña eliminada" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// RESEÑAS DEL USUARIO (para sincronizar en nuevo dispositivo)
app.get("/resenas/usuario/:usuario_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM resenas WHERE usuario_id = ? AND lugar_id_str IS NOT NULL ORDER BY id DESC",
      [req.params.usuario_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// FAVORITOS
app.get("/favoritos/:usuario_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT lugar_id_str FROM favoritos WHERE usuario_id = ?",
      [req.params.usuario_id]
    );
    res.json(rows.map(function(r) { return r.lugar_id_str; }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/favoritos", async (req, res) => {
  const { usuario_id, lugar_id_str } = req.body;
  try {
    await db.query(
      "INSERT IGNORE INTO favoritos (usuario_id, lugar_id_str) VALUES (?, ?)",
      [usuario_id, lugar_id_str]
    );
    res.json({ mensaje: "Favorito agregado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/favoritos/:usuario_id/:lugar_id_str", async (req, res) => {
  try {
    await db.query(
      "DELETE FROM favoritos WHERE usuario_id = ? AND lugar_id_str = ?",
      [req.params.usuario_id, req.params.lugar_id_str]
    );
    res.json({ mensaje: "Favorito eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── INICIO ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor corriendo en puerto", PORT));
