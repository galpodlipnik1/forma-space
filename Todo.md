1. Use db
2. Enable track search
3. Visuals (on / off)
4. Volume set
5. Layout

**BUGS:**

BIG:

1. When a user joins it adds him twice to the ui && If a user disconnects and reconnects he is added again(no remove when leaving) [done]
2. Implement a logging library to reduce the impact of console.log in production the logger logs to the logs folder with errors seperated and if the NODE_ENV is set to production the logger will not display in console to save resources [done]

Small:

1.favicons not loading

2.The to clipboard is using the old "deprecated" way of copying [done]

3.Added /** notation to the functions for better readability
