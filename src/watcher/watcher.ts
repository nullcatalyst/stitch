export default abstract class Watcher {
    abstract start(callback: (filePath: string) => Promise<void>): () => Promise<void>;
}
