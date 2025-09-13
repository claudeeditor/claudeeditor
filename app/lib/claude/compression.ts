// lib/claude/compression.ts
import prettier from 'prettier';

// ========== Types ==========
interface CompressionResult {
  compressed: string;
  original: string;
  saved: number;
  tokenEstimate: number;
}

type CompressionLevel = 'light' | 'medium' | 'maximum';

interface CompressionStats {
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
  savedPercentage: number;
  estimatedTokens: number;
  compressionLevel: CompressionLevel;
}

// ========== Configuration ==========
const COMPRESSION_CONFIG = {
  tokenRatio: 4, // Characters per token estimate
  maxVarMappings: 10,
  prettierOptions: {
    parser: 'typescript' as const,
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: true,
    trailingComma: 'es5' as const,
    bracketSpacing: true,
    arrowParens: 'avoid' as const,
    endOfLine: 'lf' as const,
  },
};

// ========== Main Class ==========
export class CodeTransformManager {
  private humanReadable = '';
  private claudeOptimized = '';
  private compressionLevel: CompressionLevel = 'medium';
  private varMappings = new Map<string, Map<string, string>>();

  // ========== Public Methods ==========
  onUserEdit(newCode: string): CompressionResult {
    this.humanReadable = newCode;
    this.claudeOptimized = this.compressForClaude(newCode);

    const saved = this.calculateSavedPercentage();
    const tokenEstimate = this.estimateTokens(this.claudeOptimized);

    this.logCompressionStats(newCode.length, this.claudeOptimized.length, saved, tokenEstimate);

    return {
      compressed: this.claudeOptimized,
      original: newCode,
      saved,
      tokenEstimate
    };
  }

  async onClaudeResponse(claudeCode: string): Promise<string> {
    const cleaned = this.cleanupCode(claudeCode);
    const beautified = await this.beautifyCode(cleaned);
    
    this.humanReadable = beautified;
    this.claudeOptimized = this.compressForClaude(beautified);
    
    return beautified;
  }

  setCompressionLevel(level: CompressionLevel): void {
    this.compressionLevel = level;
  }

  getStats(): CompressionStats {
    return {
      originalLength: this.humanReadable.length,
      compressedLength: this.claudeOptimized.length,
      compressionRatio: this.claudeOptimized.length / Math.max(this.humanReadable.length, 1),
      savedPercentage: this.calculateSavedPercentage(),
      estimatedTokens: this.estimateTokens(this.claudeOptimized),
      compressionLevel: this.compressionLevel
    };
  }

  // ========== Private Compression Methods ==========
  private compressForClaude(code: string): string {
    const compressionMethods = {
      light: () => this.lightCompression(code),
      medium: () => this.mediumCompression(code),
      maximum: () => this.maximumCompression(code),
    };

    return compressionMethods[this.compressionLevel]();
  }

  private lightCompression(code: string): string {
    return code
      .replace(/\n\n+/g, '\n')
      .replace(/  +/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  private mediumCompression(code: string): string {
    return code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\n\s*\n/g, '\n')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}();,:])\s*/g, '$1')
      .replace(/\n/g, ' ')
      .trim();
  }

  private maximumCompression(code: string): string {
    let compressed = this.mediumCompression(code);
    
    const varMap = new Map<string, string>();
    let counter = 0;
    
    compressed = compressed.replace(
      /\b(const|let|var|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]{3,})/g,
      (match, keyword, name) => {
        if (!varMap.has(name)) {
          varMap.set(name, `v${counter++}`);
        }
        return `${keyword} ${varMap.get(name)}`;
      }
    );
    
    this.storeVarMapping(varMap);
    return compressed;
  }

  // ========== Private Cleanup Methods ==========
  private cleanupCode(code: string): string {
    let cleaned = code.replace(/\b(const|let|var|function|if|else|for|while|return)\b/g, '$1 ');
    cleaned = cleaned.replace(/([;{}])/g, '$1\n');
    cleaned = cleaned.replace(/([=+\-*/%<>!&|])/g, ' $1 ');
    return cleaned;
  }

  private async beautifyCode(code: string): Promise<string> {
    try {
      return await prettier.format(code, COMPRESSION_CONFIG.prettierOptions);
    } catch (error) {
      console.warn('Prettier formatting failed, returning cleaned code:', error);
      return code;
    }
  }

  // ========== Helper Methods ==========
  private calculateSavedPercentage(): number {
    if (this.humanReadable.length === 0) return 0;
    return Math.round((1 - this.claudeOptimized.length / this.humanReadable.length) * 100);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / COMPRESSION_CONFIG.tokenRatio);
  }

  private storeVarMapping(mapping: Map<string, string>): void {
    const timestamp = Date.now().toString();
    this.varMappings.set(timestamp, mapping);
    
    if (this.varMappings.size > COMPRESSION_CONFIG.maxVarMappings) {
      const firstKey = this.varMappings.keys().next().value;
      this.varMappings.delete(firstKey);
    }
  }

  private logCompressionStats(original: number, compressed: number, saved: number, tokens: number): void {
    console.log(`
      📄 Original: ${original} chars
      📦 Compressed: ${compressed} chars
      💰 Saved: ${saved}%
      🎯 Estimated tokens: ${tokens}
    `);
  }
}

// ========== Pattern Compressor ==========
export class PatternCompressor {
  private readonly patterns = new Map([
    ['import React from \'react\'', 'iR'],
    ['import { useState } from \'react\'', 'iUS'],
    ['import { useEffect } from \'react\'', 'iUE'],
    ['export default function', 'edf'],
    ['export default', 'ed'],
    ['className=', 'cn='],
    ['onClick=', 'oc='],
    ['onChange=', 'och='],
    ['useState(', 'us('],
    ['useEffect(', 'ue('],
    ['function', 'fn'],
    ['return', 'ret'],
    ['const', 'c'],
    ['let', 'l'],
    ['var', 'v'],
  ]);

  compress(code: string): string {
    let compressed = code;
    this.patterns.forEach((short, long) => {
      compressed = compressed.replace(new RegExp(long, 'g'), short);
    });
    return compressed;
  }

  decompress(code: string): string {
    let decompressed = code;
    const reversePatterns = new Map(
      Array.from(this.patterns.entries()).map(([k, v]) => [v, k])
    );
    
    reversePatterns.forEach((long, short) => {
      decompressed = decompressed.replace(new RegExp(short, 'g'), long);
    });
    
    return decompressed;
  }
}

// ========== Semantic Compressor ==========
export class SemanticCompressor {
  compressJSX(jsx: string): string {
    let compressed = jsx.replace(/>\s+</g, '><');
    compressed = compressed.replace(/className="([^"]+)"/g, (match, classes) => {
      const compressedClasses = classes.split(/\s+/).join(' ');
      return `className="${compressedClasses}"`;
    });
    return compressed;
  }

  compressImports(code: string): string {
    const importMap = new Map<string, string[]>();
    const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const [, namedImports, namespaceImport, defaultImport, module] = match;
      
      if (!importMap.has(module)) {
        importMap.set(module, []);
      }
      
      const imports = importMap.get(module)!;
      if (namedImports) {
        imports.push(...namedImports.split(',').map(s => s.trim()));
      }
      if (namespaceImport) {
        imports.push(`* as ${namespaceImport}`);
      }
      if (defaultImport) {
        imports.push(defaultImport);
      }
    }
    
    let compressedImports = '';
    importMap.forEach((imports, module) => {
      if (imports.length > 0) {
        compressedImports += `import{${imports.join(',')}}from'${module}';`;
      }
    });
    
    return compressedImports;
  }
}