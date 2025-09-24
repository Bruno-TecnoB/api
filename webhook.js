const http = require("http");
const { exec } = require("child_process");

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/webhook") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);

        // Só executa se o push for na branch producao
        if (payload.ref === "refs/heads/producao") {
          console.log("🚀 Deploy iniciado...");
          exec("sh ./deploy.sh", { cwd: "/var/www/tecnobil.dev" }, (err, stdout, stderr) => {
            if (err) console.error("Erro:", err);
            console.log(stdout);
            console.error(stderr);
          });
        }
      } catch (e) {
        console.error("Erro ao processar payload:", e);
      }

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Webhook recebido\n");
    });
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(9000, () => console.log("Webhook rodando na porta 9000"));
