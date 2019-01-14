![Build status](https://api.travis-ci.com/wrattler/wrattler.svg?branch=master)

If you get

> ERROR: for wrattler_wrattler_client_1  Cannot create container for service wrattler_client: b'Drive has not been shared'

You need to share your drives in Docker settings ([Windows](https://blogs.msdn.microsoft.com/stevelasker/2016/06/14/configuring-docker-for-windows-volumes/))

But automatic reload does not work on Windows anyway:
See https://github.com/docker/compose/issues/4326 and https://github.com/docker/for-win/issues/56
