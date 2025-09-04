cd /var/www/tecnobil.dev || exit

echo "🔄 Atualizando código da branch produção..."
git fetch origin producao
git reset --hard origin/producao

echo "📦 Instalando dependências..."
npm install --production

echo "♻️ Reiniciando aplicação..."
pm2 restart api
