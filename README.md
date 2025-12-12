# Colima GUI

Colima GUI is a desktop application for managing Colima, a tool that provides container runtimes on macOS with minimal setup. The application now runs on [Electron](https://www.electronjs.org/) with a React renderer bundled by Vite and managed with [Bun](https://bun.sh/).

## Features

- Start, stop, and restart Colima instances
- Check the status of Colima

## Installation

### Prerequisites

- [Bun](https://bun.sh/) v1.3 or later (installs Node-compatible dependencies and runs scripts)
- macOS with Colima available on the `PATH`

### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/colima-gui.git
   cd colima-gui
   ```

2. Install dependencies via Bun:

   ```bash
   bun install
   ```

3. Run the application in development mode (starts Vite and Electron concurrently):

   ```bash
   bun run dev
   ```

4. Create a packaged desktop build:

   ```bash
   bun run build
   ```

## Usage

Once the application is running, you can use the provided buttons to manage your Colima instances. The terminal output will display the results of the commands executed.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

If you have any questions or issues, please open an issue in this repository.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Bun VS Code Extension](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

