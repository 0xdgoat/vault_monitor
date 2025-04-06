import axios from 'axios';

// File: /Users/ishansingh/Desktop/vault_monitor/src/scripts/slackHandler.ts


/**
 * Sends an alert message to a Slack channel.
 * 
 * @param {string} token - The Slack bot token.
 * @param {string} channelId - The ID of the Slack channel to send the message to.
 * @param {string} message - The message to send.
 */
export async function sendAlert(token: string, channelId: string, message: string): Promise<void> {
    const url = 'https://slack.com/api/chat.postMessage';

    try {
        const response = await axios.post(
            url,
            {
                channel: channelId,
                text: message,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        if (response.data.ok) {
            console.log('Message sent successfully:', response.data);
        } else {
            console.error('Error sending message:', response.data.error);
        }
    } catch (error) {
        console.error('Error making API call:', error);
    }
}


export async function sendSlackAlert(message:String){
    const slackToken =  process.env.SLACK_BOT_TOKEN as string; // Replace with your Slack bot token
    const channelId = process.env.CHANNEL_ID as string; // Replace with your Slack channel ID
      
      try {
        await sendAlert(slackToken, channelId, message as string);
        
      } catch (error) {
        console.error("Error sending Slack alert:", error);
        
      }
}
/*
// Example usage
(async () => {
    const slackToken = 'abcd'; // Replace with your Slack bot token
    const channelId = 'dkinkindk'; // Replace with your Slack channel ID
    const alertMessage = 'This is a test alert from the Slack bot!';

    await sendAlert(slackToken, channelId, alertMessage);
})();

*/
