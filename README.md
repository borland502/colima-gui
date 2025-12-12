# Colima GUI

Colima GUI is a desktop application for managing Colima, a tool that provides container runtimes on macOS with minimal setup. The application now runs on [Electron](https://www.electronjs.org/) with a React renderer bundled by Vite and managed with [Bun](https://bun.sh/).

## Features

- Start, stop, and restart Colima instances
- Check the status of Colima

## Installation

### Build from Source

Releases contain source code only. You'll need to build the application locally.

#### Prerequisites

- [Bun](https://bun.sh/) v1.3 or later
- macOS with Colima available on the `PATH`

#### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/borland502/colima-gui.git
   cd colima-gui
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Build the application (creates DMG and ZIP in `release/` directory):

   ```bash
   bun run build
   ```

4. Install the app:
   - Open the DMG from `release/` and drag to Applications, or
   - Extract the ZIP and move the app to Applications

### Development Mode

Run the application in development mode (starts Vite and Electron concurrently):

```bash
bun run dev
```


## Usage

Once the application is running, you can use the provided buttons to manage your Colima instances. The terminal output will display the results of the commands executed.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

If you have any questions or issues, please open an issue in this repository.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Bun VS Code Extension](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

