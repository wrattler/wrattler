curl -sS http://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
echo "deb http://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
apt update
apt remove cmdtest -y
apt install yarn -y
echo "Installed Yarn"
curl -sL http://deb.nodesource.com/setup_8.x | bash -
apt install -y nodejs
echo "does this appear now"
