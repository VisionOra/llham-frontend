import { EditableBlock } from './types'

export const formatDate = (dateString?: string): string => {
  if (!dateString) return "Unknown"
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const countCharacters = (text: string): number => {
  const plainText = text.replace(/<[^>]*>/g, '').trim()
  return plainText.length
}

export const parseHTMLToBlocks = (html: string): EditableBlock[] => {
  if (!html) return []
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const blocks: EditableBlock[] = []
  let blockId = 0

  const processNode = (node: Node): EditableBlock | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() || ''
      if (text) {
        return {
          id: `block-${blockId++}`,
          type: 'text',
          content: text,
          attributes: {}
        }
      }
      return null
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      const tagName = element.tagName.toLowerCase()
      
      // Skip empty elements
      const textContent = element.textContent?.trim() || ''
      if (!textContent && !['br', 'hr', 'img'].includes(tagName)) {
        return null
      }

      const attributes: Record<string, string> = {}
      Array.from(element.attributes).forEach(attr => {
        attributes[attr.name] = attr.value
      })

      // For editable elements (headings, paragraphs, list items, table cells)
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'blockquote'].includes(tagName)) {
        return {
          id: `block-${blockId++}`,
          type: tagName,
          content: element.innerHTML,
          attributes
        }
      }

      // For container elements (lists, tables, divs)
      if (['ul', 'ol', 'table', 'tbody', 'thead', 'tr', 'div', 'section', 'article'].includes(tagName)) {
        const children: EditableBlock[] = []
        Array.from(element.childNodes).forEach(child => {
          const childBlock = processNode(child)
          if (childBlock) children.push(childBlock)
        })
        
        if (children.length > 0) {
          return {
            id: `block-${blockId++}`,
            type: tagName,
            content: '',
            attributes,
            children
          }
        }
      }

      // For inline elements, preserve as HTML
      if (['strong', 'em', 'b', 'i', 'u', 'a', 'span', 'code'].includes(tagName)) {
        return {
          id: `block-${blockId++}`,
          type: 'inline',
          content: element.outerHTML,
          attributes: {}
        }
      }
    }

    return null
  }

  Array.from(doc.body.childNodes).forEach(child => {
    const block = processNode(child)
    if (block) blocks.push(block)
  })

  return blocks
}

export const blocksToHTML = (blocks: EditableBlock[]): string => {
  const renderBlock = (block: EditableBlock): string => {
    const attrs = Object.entries(block.attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ')
    const attrStr = attrs ? ` ${attrs}` : ''

    if (block.type === 'text') {
      return block.content
    }

    if (block.type === 'inline') {
      return block.content
    }

    if (block.children && block.children.length > 0) {
      const childrenHTML = block.children.map(renderBlock).join('')
      return `<${block.type}${attrStr}>${childrenHTML}</${block.type}>`
    }

    return `<${block.type}${attrStr}>${block.content}</${block.type}>`
  }

  return blocks.map(renderBlock).join('')
}

export const htmlToMarkdown = (html: string): string => {
  const tempDiv = window.document.createElement('div')
  tempDiv.innerHTML = html
  
  const scripts = tempDiv.querySelectorAll('script, style')
  scripts.forEach(el => el.remove())
  
  let markdown = ''
  
  const processElement = (element: Element): string => {
    let result = ''
    const tagName = element.tagName.toLowerCase()
    
    switch (tagName) {
      case 'h1':
        result = `# ${element.textContent}\n\n`
        break
      case 'h2':
        result = `## ${element.textContent}\n\n`
        break
      case 'h3':
        result = `### ${element.textContent}\n\n`
        break
      case 'h4':
        result = `#### ${element.textContent}\n\n`
        break
      case 'h5':
        result = `##### ${element.textContent}\n\n`
        break
      case 'h6':
        result = `###### ${element.textContent}\n\n`
        break
      case 'p':
        result = `${element.textContent}\n\n`
        break
      case 'strong':
      case 'b':
        result = `**${element.textContent}**`
        break
      case 'em':
      case 'i':
        result = `*${element.textContent}*`
        break
      case 'code':
        result = `\`${element.textContent}\``
        break
      case 'pre':
        const codeElement = element.querySelector('code')
        const codeText = codeElement ? codeElement.textContent : element.textContent
        result = `\`\`\`\n${codeText}\n\`\`\`\n\n`
        break
      case 'blockquote':
        const lines = element.textContent?.split('\n') || []
        result = lines.map(line => `> ${line}`).join('\n') + '\n\n'
        break
      case 'ul':
      case 'ol':
        const listItems = Array.from(element.children)
        listItems.forEach((li, index) => {
          const prefix = tagName === 'ul' ? '-' : `${index + 1}.`
          result += `${prefix} ${li.textContent}\n`
        })
        result += '\n'
        break
      case 'a':
        const href = element.getAttribute('href') || ''
        result = `[${element.textContent}](${href})`
        break
      case 'img':
        const src = element.getAttribute('src') || ''
        const alt = element.getAttribute('alt') || ''
        result = `![${alt}](${src})\n\n`
        break
      case 'table':
        result = processTable(element)
        break
      case 'br':
        result = '\n'
        break
      default:
        Array.from(element.childNodes).forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            result += child.textContent
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            result += processElement(child as Element)
          }
        })
        break
    }
    
    return result
  }
  
  const processTable = (table: Element): string => {
    let tableMarkdown = ''
    const rows = Array.from(table.querySelectorAll('tr'))
    
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('td, th'))
      const cellContents = cells.map(cell => cell.textContent?.trim() || '')
      tableMarkdown += `| ${cellContents.join(' | ')} |\n`
      
      if (rowIndex === 0) {
        tableMarkdown += `| ${cells.map(() => '---').join(' | ')} |\n`
      }
    })
    
    return tableMarkdown + '\n'
  }
  
  Array.from(tempDiv.children).forEach(child => {
    markdown += processElement(child as Element)
  })
  
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim()
  
  return markdown
}

