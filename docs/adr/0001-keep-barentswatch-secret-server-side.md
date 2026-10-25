# Keep the BarentsWatch client secret on the server

The BarentsWatch token endpoint needs the client secret, so a browser-only app would expose it. The server holds the secret, caches the access token, and serves vessel positions to the browser. A static snapshot was rejected because it would not show current positions.
