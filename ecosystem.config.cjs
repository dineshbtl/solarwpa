/**
 * PM2 config – app runs on port 6001.
 * Use npm scripts (pm2 is local, not global):
 *   npm run pm2:start   npm run pm2:restart   npm run pm2:stop
 *   npm run pm2:list   npm run pm2:logs   npm run pm2:save
 */
module.exports = {
  apps: [
    {
      name: 'solar-epc',
      cwd: __dirname,
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        PORT: 6001,
        NODE_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
