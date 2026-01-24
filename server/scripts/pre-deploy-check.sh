#!/bin/bash
# Script de verificación final antes del deploy

echo "🔍 VERIFICACIÓN FINAL PRE-DEPLOY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ALL_OK=true

# 1. Verificar Git
echo "1️⃣  Git Status"
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo "   ✅ Git repository detectado"
  
  # Verificar si hay cambios sin commitear
  if [[ -n $(git status -s) ]]; then
    echo "   ⚠️  Hay cambios sin commitear:"
    git status -s | head -10
    ALL_OK=false
  else
    echo "   ✅ No hay cambios pendientes"
  fi
  
  # Verificar branch
  BRANCH=$(git branch --show-current)
  echo "   📍 Branch actual: $BRANCH"
else
  echo "   ❌ No es un repositorio Git"
  ALL_OK=false
fi
echo ""

# 2. Verificar .gitignore
echo "2️⃣  Archivos Sensibles"
SENSITIVE_FILES=(
  "beezero-62dea82962da.json"
  "server/.env"
  ".env"
  "secret/"
)

for file in "${SENSITIVE_FILES[@]}"; do
  if git check-ignore "$file" > /dev/null 2>&1; then
    echo "   ✅ $file está ignorado por git"
  else
    if [ -e "$file" ] || [ -d "$file" ]; then
      echo "   ❌ $file NO está ignorado y existe!"
      ALL_OK=false
    else
      echo "   ⚠️  $file no existe (OK si no se usa)"
    fi
  fi
done
echo ""

# 3. Verificar AWS Secrets
echo "3️⃣  AWS Secrets Manager"
if aws secretsmanager describe-secret --secret-id pedidos/prod/all-secrets > /dev/null 2>&1; then
  echo "   ✅ Secreto existe en AWS"
  
  # Verificar contenido
  if node server/scripts/verify-secrets.mjs > /dev/null 2>&1; then
    echo "   ✅ Secretos críticos presentes"
  else
    echo "   ❌ Faltan secretos críticos"
    ALL_OK=false
  fi
else
  echo "   ❌ Secreto no encontrado en AWS"
  ALL_OK=false
fi
echo ""

# 4. Verificar IAM Policy
echo "4️⃣  IAM Policy"
if aws iam get-policy --policy-arn arn:aws:iam::447924811196:policy/PedidosAmplifySecretsAccess > /dev/null 2>&1; then
  echo "   ✅ Política de IAM creada"
else
  echo "   ❌ Política de IAM no encontrada"
  ALL_OK=false
fi
echo ""

# 5. Verificar archivos necesarios
echo "5️⃣  Archivos de Configuración"
REQUIRED_FILES=(
  "amplify.yml"
  "package.json"
  "server/package.json"
  "server/index.js"
  "server/utils/secrets.js"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file existe"
  else
    echo "   ❌ $file NO ENCONTRADO"
    ALL_OK=false
  fi
done
echo ""

# 6. Verificar dependencias
echo "6️⃣  Dependencias Node.js"
if [ -d "node_modules" ]; then
  echo "   ✅ node_modules presente"
else
  echo "   ⚠️  node_modules no encontrado (ejecuta npm install)"
fi

if [ -d "server/node_modules" ]; then
  echo "   ✅ server/node_modules presente"
else
  echo "   ⚠️  server/node_modules no encontrado (ejecuta cd server && npm install)"
fi
echo ""

# 7. Verificar scripts de build
echo "7️⃣  Scripts de Build"
if grep -q '"build"' package.json; then
  echo "   ✅ Script de build encontrado en package.json"
else
  echo "   ❌ Script de build NO encontrado en package.json"
  ALL_OK=false
fi
echo ""

# Resumen final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ALL_OK" = true ]; then
  echo "✅ TODAS LAS VERIFICACIONES PASARON"
  echo ""
  echo "🚀 Estás listo para deployar a AWS Amplify"
  echo ""
  echo "Próximos pasos:"
  echo "1. git push origin $BRANCH"
  echo "2. Ve a AWS Amplify Console"
  echo "3. Conecta tu repositorio"
  echo "4. Configura variables de entorno"
  echo "5. Deploy!"
  echo ""
  echo "📖 Lee DEPLOY_CHECKLIST.md para instrucciones detalladas"
else
  echo "❌ HAY PROBLEMAS QUE RESOLVER"
  echo ""
  echo "Por favor, corrige los errores marcados arriba antes de deployar"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
