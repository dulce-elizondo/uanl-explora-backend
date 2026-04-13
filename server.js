const express = require("express");
const mysql   = require("mysql2/promise");
const cors    = require("cors");
const multer  = require("multer");
const path    = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Servir imágenes subidas como archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de multer — guarda en carpeta uploads/
const storage = multer.diskStorage({
  destination: function(_req, _file, cb) { cb(null, path.join(__dirname, 'uploads')); },
  filename:    function(_req, file, cb)  { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage });

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
  const fotoNombre = req.file ? req.file.filename : null;
  try {
    const [result] = await db.query(
      "INSERT INTO lugares (nombre, categoria, descripcion, imagen) VALUES (?, ?, ?, ?)",
      [nombre, categoria || null, descripcion || null, fotoNombre]
    );
    res.json({ id: result.insertId, nombre, categoria, descripcion, foto: fotoNombre });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// RESEÑAS
app.post("/resenas", async (req, res) => {
  const { usuario_id, lugar_id, comentario, calificacion } = req.body;
  try {
    await db.query(
      "INSERT INTO resenas (usuario_id, lugar_id, comentario, calificacion) VALUES (?, ?, ?, ?)",
      [usuario_id, lugar_id, comentario, calificacion]
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
app.post("/registro", async (req, res) => {
  const { nombre, apellido, usuario, password, foto } = req.body;
  if (!nombre || !apellido || !usuario || !password) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  try {
    const [rows] = await db.query("SELECT id FROM usuarios WHERE usuario = ?", [usuario]);
    if (rows.length > 0) return res.status(409).json({ error: "Ese nombre de usuario ya está en uso" });

    const [result] = await db.query(
      "INSERT INTO usuarios (nombre, apellido, usuario, password, foto) VALUES (?, ?, ?, ?, ?)",
      [nombre, apellido, usuario, password, foto || null]
    );
    res.json({ id: result.insertId, nombre, apellido, usuario, foto: foto || null });
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
  const fotoNombre = req.file ? req.file.filename : null;
  try {
    const [result] = await db.query(
      "INSERT INTO negocios (usuario_id, nombre, categoria, descripcion, dias, horario, ubicacion, foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [usuario_id || null, nombre, categoria || null, descripcion || null,
       dias || null, horario || null, ubicacion || null, fotoNombre]
    );
    res.json({ id: result.insertId, nombre, categoria, descripcion, dias, horario, ubicacion, foto: fotoNombre });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/negocios/:id/foto", upload.single("foto"), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: "Se requiere una foto" });
  try {
    await db.query("UPDATE negocios SET foto = ? WHERE id = ?", [req.file.filename, id]);
    res.json({ foto: req.file.filename });
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

// ─── INICIO ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor corriendo en puerto", PORT));
