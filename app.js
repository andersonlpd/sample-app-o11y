// Initialize tracing first
require('./tracing');

const express = require('express');
const promClient = require('prom-client');
const logger = require('./logger');
const { trace, context, SpanStatusCode } = require('@opentelemetry/api');

const app = express();
const port = process.env.PORT || 8080;

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'web-app'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register]
});

// Middleware to track metrics and add tracing
app.use((req, res, next) => {
  const start = Date.now();
  
  // Get current span
  const span = trace.getActiveSpan();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode
    };
    
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
    
    // Add span attributes
    if (span) {
      span.setAttributes({
        'http.method': req.method,
        'http.url': req.url,
        'http.status_code': res.statusCode,
        'http.user_agent': req.get('User-Agent') || '',
        'http.request_duration': duration
      });
      
      if (res.statusCode >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
      }
    }
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
});

// Parse JSON bodies
app.use(express.json());

// Sample data
const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' },
  { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'moderator' }
];

// Routes
app.get('/', (req, res) => {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent('Handling root request');
    span.setAttributes({
      'custom.route': 'root',
      'custom.response_type': 'html'
    });
  }
  
  logger.info('Root endpoint accessed');
  
  res.send(`
    <html>
      <head>
        <title>Local O11y Stack - Sample App</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .container { max-width: 800px; margin: 0 auto; }
          .header { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .endpoint { background: #e8f4f8; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .method { color: #0066cc; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Local Observability Stack</h1>
            <p>Sample Node.js application with full observability stack</p>
          </div>
          
          <h2>Available Endpoints:</h2>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/api/users</code> - Get all users
          </div>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/api/users/:id</code> - Get user by ID
          </div>
          
          <div class="endpoint">
            <span class="method">POST</span> <code>/api/users</code> - Create a new user
          </div>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/api/health</code> - Health check
          </div>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/api/slow</code> - Slow endpoint (for testing)
          </div>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/api/error</code> - Error endpoint (for testing)
          </div>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/metrics</code> - Prometheus metrics
          </div>
          
          <h2>Observability Stack:</h2>
          <ul>
            <li><strong>Grafana:</strong> http://localhost:3000 (admin/admin)</li>
            <li><strong>Logs:</strong> Collected by Promtail → Loki</li>
            <li><strong>Metrics:</strong> Prometheus format → Mimir</li>
            <li><strong>Traces:</strong> OpenTelemetry → Tempo</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent('Health check requested');
    span.setAttributes({
      'custom.route': 'health',
      'custom.health_status': 'ok'
    });
  }
  
  logger.info('Health check endpoint accessed');
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

app.get('/api/users', (req, res) => {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent('Fetching all users');
    span.setAttributes({
      'custom.route': 'users_list',
      'custom.users_count': users.length
    });
  }
  
  logger.info('Users list requested', { count: users.length });
  
  res.json({
    users: users,
    total: users.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const span = trace.getActiveSpan();
  
  if (span) {
    span.addEvent('Fetching user by ID');
    span.setAttributes({
      'custom.route': 'user_by_id',
      'custom.user_id': userId
    });
  }
  
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    if (span) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'User not found' });
    }
    logger.warn('User not found', { userId });
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (span) {
    span.setAttributes({
      'custom.user_name': user.name,
      'custom.user_role': user.role
    });
  }
  
  logger.info('User found', { userId, userName: user.name });
  
  res.json({
    user: user,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/users', (req, res) => {
  const span = trace.getActiveSpan();
  const { name, email, role = 'user' } = req.body;
  
  if (span) {
    span.addEvent('Creating new user');
    span.setAttributes({
      'custom.route': 'create_user',
      'custom.user_role': role
    });
  }
  
  if (!name || !email) {
    if (span) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Missing required fields' });
    }
    logger.error('User creation failed - missing fields', { name, email });
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const newUser = {
    id: Math.max(...users.map(u => u.id)) + 1,
    name,
    email,
    role
  };
  
  users.push(newUser);
  
  if (span) {
    span.setAttributes({
      'custom.user_id': newUser.id,
      'custom.user_name': newUser.name
    });
  }
  
  logger.info('User created', { userId: newUser.id, userName: newUser.name, userEmail: newUser.email });
  
  res.status(201).json({
    user: newUser,
    timestamp: new Date().toISOString()
  });
});

// Slow endpoint for testing
app.get('/api/slow', async (req, res) => {
  const span = trace.getActiveSpan();
  const delay = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds
  
  if (span) {
    span.addEvent('Slow endpoint accessed');
    span.setAttributes({
      'custom.route': 'slow',
      'custom.delay_ms': delay
    });
  }
  
  logger.info('Slow endpoint accessed', { delay });
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  res.json({ 
    message: 'This was intentionally slow',
    delay: delay,
    timestamp: new Date().toISOString()
  });
});

// Error endpoint for testing
app.get('/api/error', (req, res) => {
  const span = trace.getActiveSpan();
  
  if (span) {
    span.addEvent('Error endpoint accessed');
    span.setAttributes({
      'custom.route': 'error',
      'custom.error_type': 'intentional'
    });
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'Intentional error for testing' });
  }
  
  logger.error('Intentional error triggered');
  
  res.status(500).json({ 
    error: 'This is an intentional error for testing',
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info('Server started', { 
    port: port,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
});