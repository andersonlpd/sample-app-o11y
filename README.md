# Sample App - Observability Integration Demo

Aplicação Node.js de exemplo demonstrando integração completa com stack de observabilidade (Loki, Tempo, Mimir).

## 🎯 Objetivo

Demonstrar como instrumentar uma aplicação Node.js/Express para enviar:
- **Logs** estruturados para Loki
- **Traces** distribuídos para Tempo
- **Métricas** para Mimir/Prometheus

## 📋 Pré-requisitos

- Cluster Kubernetes rodando
- Stack de Observabilidade instalada ([local-o11y-stack](https://github.com/seu-usuario/local-o11y-stack))
- Docker para build da imagem
- kubectl configurado

## 🚀 Deploy Rápido

### 1. Build da Imagem

```bash
# Build local
docker build -t web-app:latest .

# Se estiver usando Kind, carregue a imagem
kind load docker-image web-app:latest --name o11y-cluster
```

### 2. Deploy no Kubernetes

```bash
kubectl apply -f k8s/deployment.yaml
```

### 3. Verificar

```bash
# Ver pod
kubectl get pods -l app=web-app

# Ver logs
kubectl logs -f -l app=web-app

# Port-forward
kubectl port-forward svc/web-app 8080:8080
```

### 4. Testar

```bash
# Health check
curl http://localhost:8080/api/health

# Lista de usuários
curl http://localhost:8080/api/users

# Métricas
curl http://localhost:8080/metrics

# Gerar carga
./load-test.sh 60
```

## 📦 Componentes da Aplicação

### Express Server (`app.js`)
- API REST com múltiplos endpoints
- Health checks
- Error handling
- Métricas Prometheus integradas

### Logger (`logger.js`)
- Winston configurado para logs estruturados
- Formato JSON para fácil parsing
- Níveis de log apropriados

### Tracing (`tracing.js`)
- OpenTelemetry SDK
- Instrumentação automática de HTTP
- Export via OTLP para OpenTelemetry Collector

### Métricas
- `prom-client` para métricas Prometheus
- Counters, Histograms, Gauges
- Endpoint `/metrics` para scraping

## 🔌 Integração com Stack de Observabilidade

### Logs → Loki

**Como funciona:**
1. Aplicação escreve logs JSON no stdout/stderr
2. Promtail (DaemonSet) coleta automaticamente
3. Logs são enviados para Loki
4. Visualização no Grafana

**Variáveis de ambiente:**
```yaml
# Não necessário! Promtail coleta automaticamente
# Apenas certifique-se de que os logs sejam JSON
```

**Queries no Grafana (Loki):**
```logql
{namespace="default", app="web-app"}
{namespace="default", app="web-app"} |= "error"
{namespace="default", app="web-app"} | json | level="error"
```

### Traces → Tempo

**Como funciona:**
1. OpenTelemetry SDK instrumenta requisições automaticamente
2. Traces são enviados via OTLP HTTP para OTEL Collector
3. Collector exporta para Tempo
4. Visualização no Grafana

**Variáveis de ambiente:**
```yaml
env:
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: "http://otel-collector.observability.svc.cluster.local:4318"
- name: OTEL_SERVICE_NAME
  value: "web-app"
- name: OTEL_TRACES_SAMPLER
  value: "always_on"
```

**Visualização no Grafana:**
- Explore → Tempo datasource
- Busque por service name: "web-app"
- Veja spans, duração, erros

### Métricas → Mimir

**Como funciona:**
1. `prom-client` expõe métricas em `/metrics`
2. OpenTelemetry Collector ou Prometheus scrape o endpoint
3. Métricas são enviadas para Mimir
4. Dashboards no Grafana

**Métricas expostas:**
```
http_requests_total - Counter de requisições HTTP
http_request_duration_seconds - Histogram de latência
active_requests - Gauge de requisições ativas
```

**Queries no Grafana (Mimir/Prometheus):**
```promql
rate(http_requests_total[5m])
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
sum(active_requests) by (method, route)
```

## 🌐 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Documentação da API |
| GET | `/api/health` | Health check |
| GET | `/api/users` | Lista todos os usuários |
| GET | `/api/users/:id` | Busca usuário por ID |
| POST | `/api/users` | Cria novo usuário |
| GET | `/api/slow` | Endpoint com latência (1-4s) |
| GET | `/api/error` | Gera erro 500 (teste) |
| GET | `/metrics` | Métricas Prometheus |

## 🧪 Teste de Carga

```bash
# Executa por 60 segundos
./load-test.sh 60

# Executa por 2 minutos
./load-test.sh 120
```

O script gera:
- Requisições aleatórias em todos os endpoints
- Mix de sucesso e erro
- Endpoints lentos e rápidos
- Útil para gerar dados de observabilidade

## 📊 Visualizando no Grafana

### 1. Acesse o Grafana

```bash
# Se usando NodePort (Kind)
http://localhost:30000

# Ou via port-forward
kubectl port-forward -n observability svc/grafana 3000:3000
# http://localhost:3000
```

**Credenciais padrão:**
- Username: `admin`
- Password: `admin123`

### 2. Explore Logs (Loki)

1. Vá para **Explore**
2. Selecione datasource **Loki**
3. Query:
   ```logql
   {namespace="default", app="web-app"}
   ```
4. Filtre por nível:
   ```logql
   {namespace="default", app="web-app"} | json | level="error"
   ```

### 3. Explore Traces (Tempo)

1. Vá para **Explore**
2. Selecione datasource **Tempo**
3. Busque por:
   - Service Name: `web-app`
   - Operation: `GET /api/users`
   - Tags: `http.status_code=500`

### 4. Dashboards (Mimir)

1. Vá para **Explore**
2. Selecione datasource **Mimir**
3. Queries úteis:
   ```promql
   # Taxa de requisições
   rate(http_requests_total{app="web-app"}[5m])
   
   # Latência p95
   histogram_quantile(0.95, 
     rate(http_request_duration_seconds_bucket{app="web-app"}[5m])
   )
   
   # Taxa de erro
   rate(http_requests_total{app="web-app",status=~"5.."}[5m])
   ```

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────┐
│           Web App (Node.js)                 │
│                                             │
│  ┌────────┐  ┌────────┐  ┌──────────────┐ │
│  │ Logger │  │ Tracer │  │ Metrics      │ │
│  │(Winston│  │ (OTEL) │  │(prom-client) │ │
│  └───┬────┘  └────┬───┘  └──────┬───────┘ │
│      │            │              │         │
└──────┼────────────┼──────────────┼─────────┘
       │            │              │
       │stdout      │OTLP HTTP     │/metrics
       │            │              │
       ▼            ▼              ▼
┌─────────────────────────────────────────────┐
│    Observability Stack (namespace: obs)     │
│                                             │
│  ┌─────────┐  ┌──────────────┐  ┌────────┐│
│  │Promtail │  │ OTEL         │  │ Scraper││
│  │         │  │ Collector    │  │        ││
│  └────┬────┘  └──────┬───────┘  └───┬────┘│
│       │              │               │     │
│       ▼              ▼               ▼     │
│  ┌────────┐    ┌─────────┐    ┌─────────┐│
│  │  Loki  │    │  Tempo  │    │  Mimir  ││
│  │(Logs)  │    │(Traces) │    │(Metrics)││
│  └────────┘    └─────────┘    └─────────┘│
│       │              │               │     │
│       └──────────────┴───────────────┘     │
│                      │                     │
│                      ▼                     │
│               ┌──────────┐                 │
│               │ Grafana  │                 │
│               │          │                 │
│               └──────────┘                 │
└─────────────────────────────────────────────┘
```

## 🔧 Desenvolvimento Local

### Sem Docker

```bash
npm install
npm start
```

### Com Docker

```bash
docker build -t web-app:latest .
docker run -p 8080:8080 \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318 \
  web-app:latest
```

## 📝 Estrutura do Projeto

```
sample-app-o11y/
├── app.js              # Aplicação Express principal
├── logger.js           # Configuração Winston
├── tracing.js          # Configuração OpenTelemetry
├── package.json        # Dependências
├── Dockerfile          # Build da imagem
├── .dockerignore       # Arquivos ignorados no build
├── k8s/
│   └── deployment.yaml # Manifests Kubernetes
├── load-test.sh        # Script de teste de carga
└── README.md           # Esta documentação
```

## 🔗 Dependências

```json
{
  "express": "^4.21.1",
  "winston": "^3.17.0",
  "prom-client": "^15.1.0",
  "@opentelemetry/sdk-node": "^0.55.0",
  "@opentelemetry/auto-instrumentations-node": "^0.52.0",
  "@opentelemetry/exporter-trace-otlp-http": "^0.55.0"
}
```

## 🚦 Próximos Passos

- [ ] Adicionar dashboards Grafana pré-configurados
- [ ] Exemplos de alertas
- [ ] Testes de integração
- [ ] CI/CD pipeline
- [ ] Exemplos em outras linguagens (Python, Go, Java)

## 🐛 Troubleshooting

### Pod não inicia

```bash
kubectl describe pod -l app=web-app
kubectl logs -l app=web-app
```

### Traces não aparecem no Tempo

Verifique:
1. OTEL Collector está rodando: `kubectl get pods -n observability -l app=otel-collector`
2. Endpoint está correto: `http://otel-collector.observability.svc.cluster.local:4318`
3. Logs do OTEL Collector: `kubectl logs -n observability -l app=otel-collector`

### Logs não aparecem no Loki

Verifique:
1. Promtail está rodando: `kubectl get pods -n observability -l app=promtail`
2. Logs do Promtail: `kubectl logs -n observability -l app=promtail`
3. Logs da app estão em JSON: `kubectl logs -l app=web-app`

## 📚 Referências

- [OpenTelemetry Node.js](https://opentelemetry.io/docs/instrumentation/js/)
- [Winston Logger](https://github.com/winstonjs/winston)
- [Prometheus Node.js Client](https://github.com/siimon/prom-client)
- [Express.js](https://expressjs.com/)

## 🤝 Contribuindo

Contribuições são bem-vindas! Abra issues ou pull requests.

## 📄 Licença

MIT

---

**Exemplo completo de aplicação instrumentada para observabilidade** 🔍
