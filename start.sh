yarn install
dotnet restore
cd src 
dotnet fable yarn-start
curl -i http://localhost:8080/broadband.html
