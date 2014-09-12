# Autolander

Autolander is a tool which manages continuous integration workflows between Bugzilla and Github.

## Development

Using ngrok for a tunnel to localhost is the easiest way to develop.

```
./ngrok 80
```

First, fork your repository of choice. Once you have a tunnel setup, add a webhook to your repository that points to https://<id>.ngrok.com/githook/.
