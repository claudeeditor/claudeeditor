# ClaudeEditor 🚀

AI-powered code editor with automatic snapshots, mobile support, and offline capabilities. Never lose your code again with intelligent version control and Claude AI integration.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-06B6D4)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### Core Features
- 🤖 **Claude AI Integration** - Real-time AI assistance for coding
- 💾 **Auto-save System** - Never lose your work with automatic snapshots
- 📱 **Mobile Responsive** - Full functionality on mobile devices
- 🔄 **Offline Queue** - Work offline, sync when connected
- 🎤 **Voice Input** - Code with voice commands (English)
- 👆 **Swipe Gestures** - Navigate panels with touch gestures
- ⚡ **Performance Optimized** - Fast and efficient code editing

### Editor Features
- 📝 Monaco Editor (VS Code engine)
- 🌳 Virtual file system in browser
- 🎨 Syntax highlighting for multiple languages
- 🔍 IntelliSense and auto-completion
- 💾 Multiple save modes (Quick Save, Milestone Save)
- 🆘 Panic Restore (instant rollback to last working version)
- ⌨️ Keyboard shortcuts for productivity

### Mobile-First Design
- Three-panel layout on desktop
- Single-panel with navigation on mobile
- Swipe between Files, Code, and Chat panels
- Voice-to-text for coding on the go
- Touch-optimized interface

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Claude API key from Anthropic

### Installation

```bash
# Clone the repository
git clone https://github.com/claudeeditor/claudeeditor.git
cd claudeeditor

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Add your Claude API key to .env.local
ANTHROPIC_API_KEY=your-api-key-here

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start coding!

## 🛠️ Tech Stack

- **Frontend Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Code Editor**: Monaco Editor
- **Styling**: Tailwind CSS v3
- **State Management**: Zustand
- **AI Integration**: Claude API (Anthropic)
- **Deployment**: Vercel

## 📱 Browser Support

| Browser | Desktop | Mobile | Voice Input | Offline |
|---------|---------|--------|-------------|---------|
| Chrome | ✅ | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ❌ | ✅ |
| Safari | ✅ | ✅ | ⚠️ | 🟡 |

## 🎯 Voice Commands

| Command | Action |
|---------|--------|
| "Hey Claude" | Activate AI assistant |
| "Save" | Save current file |
| "Format" | Format code |
| "Undo" | Undo last action |
| "Redo" | Redo action |
| "Clear" | Clear input |
| "Stop listening" | Stop voice input |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Quick Save |
| `Cmd/Ctrl + Shift + S` | Milestone Save |
| `Cmd/Ctrl + Shift + P` | Panic Restore |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + Enter` | Send to Claude |

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Required
ANTHROPIC_API_KEY=your-claude-api-key

# Optional
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Deployment to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fclaudeeditor%2Fclaudeeditor)

1. Click the deploy button above
2. Connect your GitHub account
3. Add your `ANTHROPIC_API_KEY` in environment variables
4. Deploy!

## 📊 Performance

- Initial load time: <2s
- Time to interactive: <3s
- Lighthouse score: 95+
- Bundle size: <500KB (compressed)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - The code editor that powers VS Code
- [Anthropic Claude](https://www.anthropic.com/) - AI assistant integration
- [Next.js](https://nextjs.org/) - The React framework
- [Vercel](https://vercel.com/) - Deployment platform

## 📧 Contact

Project Link: [https://github.com/claudeeditor/claudeeditor](https://github.com/claudeeditor/claudeeditor)

---

Made with ❤️ by developers, for developers who never want to lose their code again.