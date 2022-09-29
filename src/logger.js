

class Logger {

    log(level, msg) {
        const now = new Date()
        console.log(`${now.toISOString()} : ${level} ${msg}`)
    }

    asString(msg) {
        try {
            if (msg === undefined) {
                return '[undefined]';
            }

            if (msg === null) {
                return 'null';
            }

            if (msg instanceof Error) {
                return msg.message;
            }

            if (typeof msg === 'string') {
                return msg;
            }

            return JSON.stringify(msg, null, ' ');
        } catch (err) {
            return '[unable to convert to string]';
        }
    }

    error(msg) {
        this.log('ERROR', this.asString(msg))
    }

    info(msg) {
        this.log('INFO ', this.asString(msg))
    }

    debug(msg) {
        this.log('DEBUG', this.asString(msg))
    }
}

const logger = new Logger()
export default logger
