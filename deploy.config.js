// Deployment Configuration for Real-Time Translation Chat MVP
export default {
  // Environment configurations
  environments: {
    development: {
      name: 'development',
      url: 'http://localhost:5173',
      serverUrl: 'http://localhost:3000',
      debug: true,
      analytics: false,
      errorReporting: false
    },
    
    staging: {
      name: 'staging',
      url: 'https://staging-translation-chat.example.com',
      serverUrl: 'https://staging-api.example.com',
      debug: true,
      analytics: true,
      errorReporting: true
    },
    
    production: {
      name: 'production',
      url: 'https://translation-chat.example.com',
      serverUrl: 'https://api.example.com',
      debug: false,
      analytics: true,
      errorReporting: true
    }
  },
  
  // Build configuration
  build: {
    outputDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: true,
    target: 'es2015',
    
    // Optimization settings
    optimization: {
      splitChunks: true,
      treeshaking: true,
      compression: 'gzip',
      imageOptimization: true
    },
    
    // Bundle analysis
    bundleAnalyzer: {
      enabled: false,
      openAnalyzer: false,
      reportFilename: 'bundle-report.html'
    }
  },
  
  // Server configuration
  server: {
    port: 3000,
    host: '0.0.0.0',
    cors: {
      origin: ['http://localhost:5173', 'https://translation-chat.example.com'],
      credentials: true
    },
    
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    },
    
    // Security headers
    security: {
      helmet: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", "wss:", "ws:"],
          mediaSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }
  },
  
  // Database configuration
  database: {
    development: {
      type: 'sqlite',
      database: './dev.db'
    },
    
    staging: {
      type: 'postgresql',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    },
    
    production: {
      type: 'postgresql',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: true
    }
  },
  
  // External services
  services: {
    translation: {
      primary: 'mymemory',
      fallback: 'libretranslate',
      apiKeys: {
        google: process.env.GOOGLE_TRANSLATE_API_KEY,
        azure: process.env.AZURE_TRANSLATE_API_KEY
      }
    },
    
    analytics: {
      enabled: true,
      provider: 'google-analytics',
      trackingId: process.env.GA_TRACKING_ID
    },
    
    errorReporting: {
      enabled: true,
      provider: 'sentry',
      dsn: process.env.SENTRY_DSN
    },
    
    monitoring: {
      enabled: true,
      provider: 'datadog',
      apiKey: process.env.DATADOG_API_KEY
    }
  },
  
  // Deployment strategies
  deployment: {
    strategy: 'blue-green', // 'rolling', 'blue-green', 'canary'
    
    // Health checks
    healthCheck: {
      enabled: true,
      path: '/health',
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
      retries: 3
    },
    
    // Auto-scaling
    scaling: {
      enabled: true,
      minInstances: 1,
      maxInstances: 10,
      targetCPU: 70,
      targetMemory: 80
    },
    
    // Backup strategy
    backup: {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      retention: 30 // days
    }
  },
  
  // Testing configuration
  testing: {
    unit: {
      framework: 'vitest',
      coverage: {
        enabled: true,
        threshold: 80
      }
    },
    
    integration: {
      framework: 'playwright',
      browsers: ['chromium', 'firefox', 'webkit']
    },
    
    e2e: {
      framework: 'cypress',
      baseUrl: 'http://localhost:5173'
    },
    
    performance: {
      lighthouse: {
        enabled: true,
        thresholds: {
          performance: 90,
          accessibility: 95,
          bestPractices: 90,
          seo: 85
        }
      }
    }
  },
  
  // CDN configuration
  cdn: {
    enabled: true,
    provider: 'cloudflare',
    domains: {
      assets: 'assets.translation-chat.example.com',
      api: 'api.translation-chat.example.com'
    },
    
    caching: {
      static: '1y',
      dynamic: '1h',
      api: '5m'
    }
  },
  
  // SSL/TLS configuration
  ssl: {
    enabled: true,
    provider: 'letsencrypt',
    autoRenewal: true,
    redirectHttp: true
  },
  
  // Logging configuration
  logging: {
    level: 'info',
    format: 'json',
    
    transports: {
      console: true,
      file: {
        enabled: true,
        filename: 'app.log',
        maxSize: '10m',
        maxFiles: 5
      },
      
      remote: {
        enabled: true,
        endpoint: process.env.LOG_ENDPOINT
      }
    }
  }
}
