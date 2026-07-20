import { join } from 'path';
import { rmdir, readdir, unlink } from 'fs';

export default function removeTmpDir(path: string): Promise<void> {
  return new Promise<Array<string>>((resolve, reject) => {
    readdir(path, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(files);
    });
  })
    .then(files => removeTmpFiles(files.map(name => join(path, name))))
    .then(
      () =>
        new Promise<void>((resolve, reject) => {
          rmdir(path, err => {
            if (err) {
              reject(err);
              return;
            }

            resolve();
          });
        })
    );
}

function removeTmpFiles(paths: Array<string>): Promise<Array<string>> {
  return Promise.all(
    paths.map(
      path =>
        new Promise<string>((resolve, reject) => {
          unlink(path, err => {
            if (err) {
              reject(err);
              return;
            }

            resolve(path);
          });
        })
    )
  );
}
