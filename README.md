## About the project

Simple Bittorrent client built in Node.js from scratch. Inspired by Allen Kim's [How to make your own bittorrent client](https://allenkim67.github.io/programming/2016/05/04/how-to-make-your-own-bittorrent-client.html#introduction) guide.

This guide is an excellent starting point, although it has a few issues:

- contains several bugs and typos
- it is somewhat outdated (using an npm library to deal with `bigint`)
- lacks essential features like piece verification and proper block handling at file boundaries
- does not result in a working client without significant modifications

This project builds on that foundation by fixing these issues and completing the implementation. At least in as far as allowing you to actually download a torrent.

## Usage

To start the client, run the following command:

```bash
node index.ts <path_to_torrent_file>
```

### Configuration

By default, files are saved to the current directory under `downloads`. To specify a custom download location, create a `.env` file in the root directory and add:

```env
DOWNLOAD_DIR=downloads
```
