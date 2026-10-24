module.exports = {
  apps: [{
    name: 'flashcards',
    cwd: __dirname,
    script: 'dist/server.js',
    instances: 1,
    autorestart: true,
    restart_delay: 1500,
    max_memory_restart: '100M',
    time: true,
    env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '47865' },
  }],
};
