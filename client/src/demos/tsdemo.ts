interface Message {
  text: string;
}

function writeMessage(msg:Message) {
  console.log(msg.text);
}

export function tsHello() {
  writeMessage({text:"Hello from TypeScript!"});
}