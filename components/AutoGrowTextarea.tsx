import { useRef, useEffect } from "react"


interface AutoGrowTextareaProps {
  value: string;
  setValue: (val: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export default function AutoGrowTextarea({ value, setValue, placeholder, onKeyDown }: AutoGrowTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto" // reset to shrink if needed
      const lineHeight = 24 // adjust to match your CSS (usually ~line-height)
      const maxHeight = lineHeight * 5 // 5 rows
      textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px"
    }
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      rows={1}
      placeholder={placeholder || "Type here..."}
      className="min-h-[44px] text-sm max-h-32 resize-none bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-gray-400 pt-3 ps-3 rounded-md w-full"
    />
  )
}
