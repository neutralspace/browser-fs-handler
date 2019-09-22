import { BehaviorSubject } from 'rxjs/BehaviorSubject';

/**
 * Storage types of browser`s file system.
 */
enum STORAGE_TYPES_ENUM {
  temporary = window['TEMPORARY'],
  persistent = window['PERSISTENT'],
}

/**
 * Class represents a FileHandler utility.
 * Use to write and read files using browser`s fileSystem API.
 */
export default class FileHandler {
  private fs: { [key: string]: any };
  private tasksProcessSubject: BehaviorSubject<boolean>;
  private readonly storageType: number;
  private readonly storageSize: number;
  private tasksQueue: Function[] = [];

  constructor(storageType: string, storageSize: number) {
    const requestFileSystem = window['requestFileSystem'] || window['webkitRequestFileSystem'];
    this.storageType = STORAGE_TYPES_ENUM[storageType];
    this.storageSize = storageSize;
    this.tasksProcessSubject = new BehaviorSubject(false);

    requestFileSystem(this.storageType, this.storageSize, this.initFs);

    this.tasksProcessSubject.subscribe((canPerformNewTask) => {
      if (canPerformNewTask && this.tasksQueue.length > 0) {
        this.deQueueTask();
      }
    });
  }

  /**
   * Read content of a file.
   * @param name {String} - Name of the file.
   * @param onSuccessCallback {Function} - Callback to be called on successful method
   * execution.
   * @param onErrorCallback {Function} - Callback to be called on failed method
   * execution.
   */
  readFile(name: string, onSuccessCallback?: Function, onErrorCallback?: Function): void {
    this.addTaskToQueue(() => {
      this.fs.root.getFile(name, {}, (fileEntry) => {
        fileEntry.file((file) => {
          const reader = new FileReader();

          reader.onloadend = (e) => {
            this.tasksProcessSubject.next(true);
            onSuccessCallback && onSuccessCallback(e.currentTarget['result']);
          };

          reader.readAsText(file);
        });
      }, (e) => {
        this.processError(e, onErrorCallback);
      });
    });
  }

  /**
   * Write content to a file. If file doesn`t exist, new file will be created.
   * If file already exists, previous content will be overwritten.
   * @param name {String} - Name of the file.
   * @param content {Content} - Data to be written.
   * @param onSuccessCallback {Function} - Callback to be called on successful method
   * execution.
   * @param onErrorCallback {Function} - Callback to be called on failed method
   * execution.
   */
  writeFile = (name: string, content: string, onSuccessCallback?: Function, onErrorCallback?: Function): void => {
    this.addTaskToQueue(() => {
      this.fs.root.getFile(name, { create: true }, (fileEntry) => {
        fileEntry.createWriter((fileWriter) => {
          const blob = new Blob([content], { type: 'text/plain' });

          fileWriter.onwriteend = () => {
            fileWriter.truncate(blob.size);
            fileWriter.onwriteend = null;
            onSuccessCallback && onSuccessCallback();

            this.tasksProcessSubject.next(true);
          };

          fileWriter.onerror = (e) => {
            onErrorCallback && onErrorCallback(e);
            this.tasksProcessSubject.next(true);
          };

          fileWriter.onerror = onErrorCallback;
          fileWriter.write(blob);
        }, (e) => {
          this.processError(e, onErrorCallback);
        });
      }, (e) => {
        this.processError(e, onErrorCallback);
      });
    });
  }

  /**
   * Append content to a file. If file doesn`t exist, new file will be created.
   * @param name {String} - Name of the file.
   * @param content {Content} - Data to be appended.
   * @param onSuccessCallback {Function} - Callback to be called on successful method
   * execution.
   * @param onErrorCallback {Function} - Callback to be called on failed method
   * execution.
   */
  appendToFile = (name: string, content: string, onSuccessCallback?: Function, onErrorCallback?: Function): void => {
    this.addTaskToQueue(() => {
      this.fs.root.getFile(name, { create: true }, (fileEntry) => {
        fileEntry.createWriter((fileWriter) => {
          const blob = new Blob([content], { type: 'text/plain' });
          fileWriter.seek(fileWriter.length);

          fileWriter.onwriteend = () => {
            onSuccessCallback && onSuccessCallback();

            this.tasksProcessSubject.next(true);
          };

          fileWriter.onerror = (e) => {
            onErrorCallback && onErrorCallback(e);
            this.tasksProcessSubject.next(true);
          };

          fileWriter.onerror = onErrorCallback;
          fileWriter.write(blob);
        }, (e) => {
          this.processError(e, onErrorCallback);
        });
      }, (e) => {
        this.processError(e, onErrorCallback);
      });
    });
  }

  /**
   * Add new task to a queue.
   * @param callback {Function} - Task to be queued.
   */
  private addTaskToQueue(callback: Function): void {
    this.tasksQueue.push(callback);
    if (this.tasksQueue.length === 1 && this.tasksProcessSubject.getValue()) {
      this.deQueueTask();
    }
  }

  /**
   * Get the first task in a queue and perform it.
   */
  private deQueueTask(): void {
    const callback: Function = this.tasksQueue.shift();
    this.tasksProcessSubject.next(false);
    callback();
  }

  /**
   * Call error callback and set taskProcess to perform next
   * task.
   * @param e { [key: string]: any } - Error object.
   * @param callback {Function} - Error callback.
   */
  private processError = (e, callback?: Function): void => {
    callback && callback(e);
    this.tasksProcessSubject.next(true);
  }

  /**
   * Set fs the value of DOMFileSystem instance.
   * @param fs {{ [key: string]: any }} - DOMFileSystem instance.
   */
  private initFs = (fs: { [key: string]: any }): void => {
    this.fs = fs;
    this.tasksProcessSubject.next(true);
  }
}
