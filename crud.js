const express = require("express");
const path = require("path");

const app = express();
const PORT = 3003;

app.get("/crud", (req, res) => {
  res.sendFile(path.join(__dirname, "crud.html"));
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});

app.use(express.json());

let items = [];
let nextId = 1;

// CREATE
app.post("/crud/items", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  const item = { id: nextId++, name };
  items.push(item);
  res.status(201).json(item);
});

// READ ALL
app.get("/crud/items", (req, res) => {
  res.json(items);
});

// READ ONE
app.get("/crud/items/:id", (req, res) => {
  const item = items.find((i) => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json(item);
});

// UPDATE
app.put("/api/items/:id", (req, res) => {
  const item = items.find((i) => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Item not found" });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  item.name = name;
  res.json(item);
});

// DELETE
app.delete("/api/items/:id", (req, res) => {
  const index = items.findIndex((i) => i.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Item not found" });
  items.splice(index, 1);
  res.status(204).send();
});
