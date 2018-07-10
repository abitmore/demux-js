import AbstractActionHandler from "../handlers/AbstractActionHandler"
import AbstractActionReader from "../readers/AbstractActionReader"

export default class BaseActionWatcher {
  constructor(
    protected actionReader: AbstractActionReader,
    protected actionHandler: AbstractActionHandler,
    protected pollInterval: number) {
  }

  /**
   * Uses the given actionReader and actionHandler to poll and process new blocks.
   * @returns {Promise<void>}
   */
  public async watch() {
    // Record start time
    const startTime = new Date().getTime()

    // Process blocks until we're at the head block
    let { headBlockNumber } = this.actionReader
    while (!headBlockNumber || this.actionReader.currentBlockNumber <= headBlockNumber) {
      const [blockData, rollback, firstBlock] = await this.actionReader.nextBlock()

      // Handle block (and the actions within them)
      let needToSeek = false
      let seekBlockNum = 0
      if (blockData) {
        [needToSeek, seekBlockNum] = await this.actionHandler.handleBlock(blockData, rollback, firstBlock)
      }

      // Seek to next needed block at the request of the action handler
      if (needToSeek) {
        await this.actionReader.seekToBlock(seekBlockNum - 1)
      }

      // Reset headBlockNumber on rollback for safety, as it may have decreased
      if (rollback) {
        headBlockNumber = this.actionReader.headBlockNumber
      }
    }

    // Record end time
    const endTime = new Date().getTime()

    // Calculate timing for next iteration
    const duration = endTime - startTime
    let waitTime = this.pollInterval - duration
    if (waitTime < 0) {
      waitTime = 0
    }

    // Schedule next iteration
    setTimeout(async () => this.watch, waitTime)
  }
}