# AI Assistants

AI assistants are implemented as simple console applications. You can find 
a simple Python example in the `aiassistants/test` folder. There is also an
outlier detection assistant implemented in F# in `aiassistants/outlier`.

The bit that connects individual AI assistants with Wrattler is an HTTP
server located in `aiassistants/server`. The server starts individual AI
assistant processes. The Wrattler user interface (running in the web browser) 
then makes requests to the server, which dispatches them to the individual
console applications via stdin/stdout.

To create a new AI assistant, you'll need to (a) implement it! (2) add 
a bit of configuration to let the server know how to run your AI assistant
and (3) optionally, add install scripts for your requirements to `Dockerfile`.

## Getting and running Wrattler

To run Wrattler, you will need to install [Docker](https://www.docker.com/).
We are also using [Docker compose](https://docs.docker.com/compose/), which lets
us start multiple Docker images (there is one for the central data store, one for each
language plugin and one for AI assistants). Docker compose should be installed by
default with Docker.

To get the latest version of Wrattler with AI assistant support and run it, you 
can run the following:

```
git clone -b aiassistants --single-branch https://github.com/wrattler/wrattler.git
cd wrattler
```

This fetches the source code. Now we need to build the Docker images (this might take
a long time, but it should be faster when you do this again) and run them:

```
docker-compose build
docker-compose up
```

Once everything starts, you will see something like _"wrattler_client_1: Compiled succesfully"_. 
It might take some time before this happens, but when it's ready, you can open Wrattler in your
browser by going to [http://localhost:8080](http://localhost:8080).

To stop Docker, you can hit `Ctrl+C`. You will then probably need to run `docker-compose down`
which fully removes all the running Docker images. You can also see if there are any
left running using `docker ps` and use `docker kill` to stop anything that's left 
(or `docker rm` to remove a stopped process that, for some mysterious reason, is hanging
around and blocking things...).

Once you add your new AI assistant, you can run `docker-compose build` and `dokcer-compose up`
again. This should be faster, because Docker will only need to rebuild one of the Docker
images (the one with AI assistants).

## Configuration and installation

First the boring bits! The configuration file that specifies what AI assistants
are available is `aiassistants/config.json`. This contains an array of records
with one record for each assistant. The test one looks like this:

```
{ "name": "Test assistant",
  "id": "test",
  "process": "python",
  "arguments": "test.py",
  "inputs": ["input"],
  "description": "This is a test ..." }
```

The attributes are:

 - `name` and `description` - The name and description of your assistant. 
   This is only displayed in the user interface and it is not used for anything else.
 - `id` is a unique ID of your assistant and also the name of the folder where
   the server will be looking for you assistant.
 - `process` and `arguments` tells the server how to run your assistant. For 
   Python, you can use `python` (as the process) and `yourfile.py` as the argument.
 - `input` is an array that specifies how many input data frames your assistant needs
   and also their names. For example, datadiff takes clean and messy dataframes, so
   it has `["clean", "messy"]` as the value here. The AI assistants server will use
   those names to give data to your process (see below).

If you are using some Python packages or some other language to implement your
AI assistants then you might need to modify the `aiassistants/Dockerfile` file.
This is currently based on .NET Docker image and it installs Python 3 using the
following two commands:

```
RUN apt-get update; apt-get install -y python3
RUN apt-get update; apt-get install -y python3-pip
```

You can add more `RUN` commands to install anything else you need. For example, 
if you need to install some Python packages, you can add:

```
RUN pip3 install pandas
```

## Implementing an AI assistant

Now, the interesting part! How to implement an AI assistant? An AI assistant does two things:

 - It takes some input data and makes recommendations. It offers the user a list
   of options that the user can choose from. Each option has a nice human-readable
   name and some internal representation that we'll call _query_.

 - It takes some input data and cleans them according to the query selected by
   the user.

Note that the user can ask for recommendations repeatedly, so they can make a choice, 
obtain a first query and then ask the assistant to further refine it - in this case,
the assistant will get the original query back.

The communication is all done via stdin/stdout. In the following, I will prefix 
input lines with `>` and output lines with `<` (but this is not actually done in 
your code!)

### Getting recommendations

Let's say that your assistant specified that it takes one input data frame named `input`.
Wrattler will initially call it to get recommendations, or _completions_ as follows:

```
> input=/some/temp/path/file.csv
> completions
> 
```

The three lines specify (1) inputs, (2) command and (3) query. A command can be either
`completions` or `data` (see below) and the initial query is always empty. The first line
will contain a comma-separated list of input files, using the names specified in the
`inputs` field of the `config.json` file discussed above. 

If you receive `completions` command, your assistant should respond with recommendations 
followed by an empty line. Each recommendation consists of nice name (first line) and query:

```
< remove the Foo column
< remove-foo
< remove the Bar column
< remove-bar
<
```

Let's say that the user selects the "remove the Foo column" option and wants further 
recommendations. Your assistant will then get `remove-foo` as the query and you can
respond with more complex queries. For example:

```
> input=/some/temp/path/file.csv
> completions
> remove-foo 
< remove the Bar column
< remove-foo/remove-bar
< remove the Goo column
< remove-foo/remove-goo
< 
```

The query `remove-foo/remove-bar` now represents a query that reflects the two choices
that the user made.

### Getting clean data

Now that the user made some choices, they will want to run the data cleaning and get clean
data. For this, Wrattler will again call your AI assistant and use the `data` command:

```
> input=/some/temp/path/file.csv
> data
> remove-foo/remove-bar
```

Responding to the `data` request is easy. You just need to read the input file, clean it
according to the query specified on the third line and write the result to some temporary
CSV file (you can use some standard TEMP folder or you can create `.temp` folder in your
current working directory):

```
/your/temp/folder/output.csv
```

And that's it! Happy AI assisting :-).
