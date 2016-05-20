# stats-npm

this is a proxy i use to test experimental npm features.

this was made to help understand ntworking issues like ECONNRESET in npm 
folks reported it here. https://github.com/npm/registry/issues/10

### install
```
sudo npm install -g stats-npm
```

### run
then use it just like npm.

```
snpm install yourmodule
```

after every command it appends profiling information for requests to  `./snpm-stats.log`


### server

you may also run it as a standalone server and configure it as your registry. request metadata is logged to stdout.

```
stats-npm-server --help
```

### Login

to perform actions that require write access you have to login again.

`snpm login`

snpm runs on http://localhost:8770 by default so in order for npm to forward your authentication token it requires an entry in npm rc for this host.

if you need snpm to run on another port

`snpm config set port $PORT`


### publish package signing

you can sign your publishes to npm with your ssh key!

- npm must activate this alpha test feature that may not happen in this form at all on your account.
- you must set your 2 values in your npm config

`snpm config set ssh-key $path_to_your_ssh_key`

this is `~/.ssh/id_rsa` on some machines.

`snpm config set ssh-public-key $path_to_your_matching_public_key`

for now this ssh key must be associated with your github account and this github account must be associated with your npm account.

- when you publish make sure to run `snpm publish` if this feature is active on your account publishing without signing `npm publish` will NOT WORK


