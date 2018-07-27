### How to run Wrattler via Docker(-compose)

 * Ensure you have [Docker](https://www.docker.com) installed and running on your system.
 * ```docker-compose build```
 * ```docker-compose up```

The client should be visible in your browser via ```localhost:8080```, the python service API at
```localhost:7101``` and the data-store at ```localhost:7102```.

When you want to shut it down, run (from this directory) the command ```docker-compose down```.
