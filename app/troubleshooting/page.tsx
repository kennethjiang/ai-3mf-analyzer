"use client"

import type React from "react"
import { useState, useRef } from "react"
import pako from 'pako'
import ReactMarkdown from 'react-markdown'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { Loader2, Upload, File } from "lucide-react"
import { ErrorMessage } from "@/components/error-message"
import ErrorBoundary from "@/components/error-boundary"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const MAX_FILE_SIZE_MB = 20 // Reverted from 50

export default function TroubleshootingPage() {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState<string>("")
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [aiGuidance, setAiGuidance] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]

      setError(null)
      setIsSubmitting(false)

      // Basic file type check - can be expanded later
      if (!selectedFile.name.endsWith(".gcode")) {
        setFile(null)
        setError("Please select a valid .gcode file")
        return
      }

      // Basic file size check - adjust as needed
      if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setFile(null)
        setError(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit. Please select a smaller file.`)
        return
      }

      setFile(selectedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]

      setError(null)
      setIsSubmitting(false)

      // Basic file type check
      if (!droppedFile.name.endsWith(".gcode")) {
        setFile(null)
        setError("Please select a valid .gcode file")
        return
      }

      // Basic file size check
      if (droppedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setFile(null)
        setError(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit. Please select a smaller file.`)
        return
      }

      setFile(droppedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      setError("Please select a file to analyze")
      return
    }

    setIsSubmitting(true)
    setIsLoading(true)
    setError(null)

    try {
      // Read file content
      const fileContent = await file.arrayBuffer()

      // Compress file content using pako
      const compressedData = pako.gzip(fileContent)

      // Create a Blob from the compressed data
      const compressedBlob = new Blob([compressedData])

      const formData = new FormData()
      // Append the compressed blob with a .gz extension
      formData.append("file", compressedBlob, `${file.name}.gz`)

      // Append the description to the form data
      formData.append("description", description);

      const response = await fetch("/api/troubleshooting", {
        method: "POST",
        body: formData,
      })

      // Check if the response is OK first
      if (!response.ok) {
        let errorMessage = `Request failed: ${response.status} ${response.statusText}`
        try {
          // Try to parse the error response as JSON first
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error; // Use the specific error message from the API
          } else {
            // Fallback if JSON parsing worked but no 'error' key
            errorMessage = JSON.stringify(errorData) || errorMessage;
          }
        } catch (jsonError) {
          // If JSON parsing fails, try reading as text as a last resort
          try {
            const errorText = await response.text()
            errorMessage = errorText || errorMessage // Use text if available
          } catch (textError) {
             // Ignore text reading error, fallback to status-based message is already set
            console.error("Could not read error response text:", textError)
          }
        }
        throw new Error(errorMessage)
      }

      // Only parse JSON if response is ok
      const data = await response.json()
      console.log("Troubleshooting submission successful:", data)
      setAiGuidance(data.ai_guidance || "No guidance received.")
      // Reset error on success
      setError(null);

    } catch (err) {
      console.error("Troubleshooting submission error:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred during submission")
    } finally {
      setIsLoading(false)
      // Keep isSubmitting true until results are displayed or reset
      // You might want to reset isSubmitting later based on response handling
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <ErrorBoundary>
      <main className="container mx-auto py-10 px-4 md:px-10">
        <div className="mb-8">
          <div className="flex items-center">
            <h1 className="font-bold text-3xl">
              Print Troubleshooting
            </h1>
          </div>
        </div>

        <h5 className="font-semibold mb-8">Having trouble with a print? Upload the G-Code file, and let the AI help diagnose the potential issues based on the slicer settings.</h5>

        <div className="mb-8 p-4 bg-green-100 border-l-4 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-600 dark:text-green-200 rounded-r-md">
          <div className="flex items-center">
            {/* Using a simple lightbulb character as an SVG is complex here */}
            <span className="text-lg mr-2">💡</span>
            <strong className="font-semibold">TIP</strong>
          </div>
          <p className="mt-2 text-sm">
            <a
              href="https://github.com/kennethjiang/JusPrin/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
            >
              Download JusPrin
            </a> for a fully-guided troubleshooting experience.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardDescription></CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div
                className={`border-2 border-dashed rounded-lg p-8 mb-4 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : file
                      ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileInput}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".gcode" className="hidden" />

                {file ? (
                  <div className="flex flex-col items-center">
                    <File className="h-10 w-10 text-green-500 mb-2" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Drag and drop your G-Code file here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-4 italic">Maximum file size: {MAX_FILE_SIZE_MB}MB</p>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <Label htmlFor="problem-description" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Describe the problem
                </Label>
                <Textarea
                  id="problem-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., The first layer didn't stick well... (minimum 3 words)"
                  rows={4}
                  className="w-full"
                />
              </div>

              <Button type="submit" disabled={isLoading || !file || description.trim().split(/\s+/).filter(Boolean).length < 3} className="w-full text-lg">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Take a deep breath...
                  </>
                ) : (
                  "AI lord, tell me what went wrong!"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <ErrorMessage
            title="Submission Error"
            message={error}
            type="error"
          />
        )}


        {aiGuidance && !isLoading && (
          <Card className="mt-8">
            <CardHeader>
              <h2 className="text-xl font-semibold">Troubleshooting Guidance</h2>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>
                  {aiGuidance}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </ErrorBoundary>
  )
}