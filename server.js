const express = require("express");
const mysql   = require("mysql2");
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

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "uanl_explora"
});

db.connect(err => {
  if (err) {
    console.log("Error:", err);
  } else {
    console.log("MySQL conectado");
  }
});


// 🔹 AQUÍ YA TENÍAS ESTO
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});


// 🔥 👉 AQUÍ VA EL PASO 3 (debajo del /)
app.get("/lugares", (req, res) => {
  db.query("SELECT * FROM lugares", (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
});

app.post("/lugares", upload.single("foto"), (req, res) => {
  const { nombre, categoria, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

  const fotoNombre = req.file ? req.file.filename : null;

  const sql = "INSERT INTO lugares (nombre, categoria, descripcion, imagen) VALUES (?, ?, ?, ?)";
  db.query(sql, [nombre, categoria || null, descripcion || null, fotoNombre], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: result.insertId, nombre, categoria, descripcion, foto: fotoNombre });
  });
});
app.post("/resenas", (req, res) => {
  const { usuario_id, lugar_id, comentario, calificacion } = req.body;

  const sql = `
    INSERT INTO resenas (usuario_id, lugar_id, comentario, calificacion)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [usuario_id, lugar_id, comentario, calificacion], (err, result) => {
    if (err) {
      return res.json(err);
    }
    res.json({ mensaje: "Reseña guardada" });
  });
});
app.get("/resenas", (req, res) => {
  db.query("SELECT * FROM resenas", (err, result) => {
    if (err) {
      return res.json(err);
    }
    res.json(result);
  });
});

// REGISTRO
app.post("/registro", (req, res) => {
  const { nombre, apellido, usuario, password, foto } = req.body;

  if (!nombre || !apellido || !usuario || !password) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  // Verificar que el usuario no exista ya
  db.query("SELECT id FROM usuarios WHERE usuario = ?", [usuario], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length > 0) return res.status(409).json({ error: "Ese nombre de usuario ya está en uso" });

    const sql = `INSERT INTO usuarios (nombre, apellido, usuario, password, foto) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [nombre, apellido, usuario, password, foto || null], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: result.insertId,
        nombre,
        apellido,
        usuario,
        foto: foto || null
      });
    });
  });
});

// LOGIN
app.post("/login", (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: "Faltan campos" });
  }

  db.query(
    "SELECT id, nombre, apellido, usuario, foto FROM usuarios WHERE usuario = ? AND password = ?",
    [usuario, password],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      res.json(rows[0]);
    }
  );
});
// NEGOCIOS
app.get("/negocios", (_req, res) => {
  db.query("SELECT * FROM negocios ORDER BY created_at DESC", (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
});

app.post("/negocios", upload.single("foto"), (req, res) => {
  const { usuario_id, nombre, categoria, descripcion, dias, horario, ubicacion } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

  // Solo guardar el nombre del archivo, no base64
  const fotoNombre = req.file ? req.file.filename : null;

  const sql = `INSERT INTO negocios (usuario_id, nombre, categoria, descripcion, dias, horario, ubicacion, foto)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [usuario_id || null, nombre, categoria || null, descripcion || null,
                 dias || null, horario || null, ubicacion || null, fotoNombre], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: result.insertId, nombre, categoria, descripcion, dias, horario, ubicacion, foto: fotoNombre });
  });
});

// ACTUALIZAR FOTO DE NEGOCIO
app.put("/negocios/:id/foto", upload.single("foto"), (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: "Se requiere una foto" });
  const fotoNombre = req.file.filename;
  db.query("UPDATE negocios SET foto = ? WHERE id = ?", [fotoNombre, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ foto: fotoNombre });
  });
});

// ELIMINAR NEGOCIO
app.delete("/negocios/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM negocios WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: "Negocio eliminado" });
  });
});

// MIS RESEÑAS (reseñas del usuario logueado)
app.get("/mis-resenas/:usuario_id", (req, res) => {
  const { usuario_id } = req.params;
  const sql = `
    SELECT r.*, l.nombre AS lugar_nombre, l.categoria
    FROM resenas r
    LEFT JOIN lugares l ON r.lugar_id = l.id
    WHERE r.usuario_id = ?
    ORDER BY r.id DESC
  `;
  db.query(sql, [usuario_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
});

// 🔹 SIEMPRE AL FINAL
app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});

