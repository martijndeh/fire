import AWS from 'aws-sdk';

export default class Queue {
    constructor(queueUrl) {
        const {
            AWS_SQS_ACCESS_KEY_ID,
            AWS_SQS_SECRET_ACCESS_KEY,
            AWS_SQS_REGION,
            AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY,
            AWS_REGION,
        } = process.env;

        this.queueUrl = queueUrl;
        this.sqs = new AWS.SQS({
            accessKeyId: AWS_SQS_ACCESS_KEY_ID || AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SQS_SECRET_ACCESS_KEY || AWS_SECRET_ACCESS_KEY,
            region: AWS_SQS_REGION || AWS_REGION,
        });
    }

    sendMessage(name, args) {
        return new Promise((resolve, reject) => {
            const body = {
                name,
                args,
            };
            const params = {
                QueueUrl: this.queueUrl,
                MessageBody: JSON.stringify(body),
            };

            this.sqs.sendMessage(params, (error, data) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(data);
                }
            });
        });
    }

    deleteMessage(receiptHandle) {
        return new Promise((resolve, reject) => {
            const params = {
                QueueUrl: this.queueUrl,
                ReceiptHandle: receiptHandle,
            };

            this.sqs.deleteMessage(params, (error, data) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(data);
                }
            });
        });
    }

    receiveMessage(callback) {
        return new Promise((resolve, reject) => {
            const params = {
                QueueUrl: this.queueUrl,
                VisibilityTimeout: 30 * 60,
                WaitTimeSeconds: 20,
            };

            this.sqs.receiveMessage(params, async (error, data) => {
                if (error) {
                    reject(error);
                }
                else {
                    const messages = data.Messages;

                    if (messages && messages.length > 0) {
                        await Promise.all(messages.map(async (message) => {
                            try {
                                const body = JSON.parse(message.Body);
                                const {
                                    name,
                                    args,
                                } = body;

                                await Promise.resolve(callback(name, args));

                                await this.deleteMessage(message.ReceiptHandle);
                            }
                            catch (e) {
                                // TODO: Should we delete this message?
                            }
                        }));

                        resolve(true);
                    }
                    else {
                        resolve(false);
                    }
                }
            });
        });
    }
}
