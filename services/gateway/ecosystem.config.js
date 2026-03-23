{
  "apps": [
    {
      "name": "caiwu-gateway",
      "script": "src/index.js",
      "cwd": "/Users/mac/Desktop/caiwu/services/gateway",
      "instances": 1,
      "exec_mode": "fork",
      "watch": false,
      "autorestart": true,
      "max_restarts": 10,
      "restart_delay": 3000,
      "env": {
        "NODE_ENV": "production"
      },
      "env_development": {
        "NODE_ENV": "development"
      },
      "error_file": "logs/error.log",
      "out_file": "logs/out.log",
      "log_file": "logs/combined.log",
      "time": true,
      "merge_logs": true,
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
}