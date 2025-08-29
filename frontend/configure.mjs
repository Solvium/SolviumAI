import axios from "axios";
import { configDotenv } from "dotenv";

configDotenv();

function exitError(error) {
  console.error(`Error! ${error}`);
  process.exit(1);
}

const banner = `
████████╗██╗    ██╗ █████╗     ████████╗███████╗███╗   ███╗██████╗ ██╗      █████╗ ████████╗███████╗
╚══██╔══╝██║    ██║██╔══██╗    ╚══██╔══╝██╔════╝████╗ ████║██╔══██╗██║     ██╔══██╗╚══██╔══╝██╔════╝
   ██║   ██║ █╗ ██║███████║       ██║   █████╗  ██╔████╔██║██████╔╝██║     ███████║   ██║   █████╗  
   ██║   ██║███╗██║██╔══██║       ██║   ██╔══╝  ██║╚██╔╝██║██╔═══╝ ██║     ██╔══██║   ██║   ██╔══╝  
   ██║   ╚███╔███╔╝██║  ██║       ██║   ███████╗██║ ╚═╝ ██║██║     ███████╗██║  ██║   ██║   ███████╗
   ╚═╝    ╚══╝╚══╝ ╚═╝  ╚═╝       ╚═╝   ╚══════╝╚═╝     ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
`;

console.log(banner);

return;
let botUsername;

(async () => {
  const accessToken = process.env.TG_BOT_TOKEN;

  console.log(accessToken);

  const getBot = await axios
    .get(`https://api.telegram.org/bot${accessToken}/getMe`)
    .catch(exitError);

  botUsername = getBot.data.result.username;

  const url =
    process.env.NODE_ENV == "production"
      ? process.env.PROD_URL ?? ""
      : process.env.TEST_URL ?? "";

  console.log(`\n\nSetting bot ${botUsername} webapp url to ${url}`);

  const setresp = await axios
    .get(
      `https://api.telegram.org/bot${accessToken}/setWebhook?url=${url}api/allroute`
    )
    .catch(exitError);

  // if (setresp.status === 200) {
  //   console.log(setresp.data);
  // } else {
  //   console.log(setresp.error);
  // }

  // const resp = await axios
  //   .post(`https://api.telegram.org/bot${accessToken}/setChatMenuButton`, {
  //     menu_button: {
  //       type: "web_app",
  //       text: "Launch Webapp",
  //       web_app: {
  //         url: url,
  //       },
  //     },
  //   })
  //   .catch(exitError);

  if (setresp.status === 200) {
    console.log(setresp.data);
    console.log(
      `\nYou're all set! Visit https://t.me/${botUsername} to interact with your bot`
    );
    process.exit();
  } else {
    exitError(`\nSomething went wrong! ${resp.error}`);
  }
})();
