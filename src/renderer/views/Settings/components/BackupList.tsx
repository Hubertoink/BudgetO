import React from 'react'
import { BackupInfo } from '../types'

interface BackupListProps {
  backups: BackupInfo[]
  onRestore: (backup: BackupInfo) => void
}

/**
 * Extracts just the filename from a full path
 */
function fileName(fullPath: string): string {
  const parts = fullPath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || fullPath
}

/**
 * Formats date as relative time (e.g., "vor 2 Tagen")
 */
function relativeTime(mtime: number): string {
  const now = Date.now()
  const diff = now - mtime
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `vor ${minutes} Min.`
  if (hours < 24) return `vor ${hours} Std.`
  if (days === 1) return 'gestern'
  if (days < 7) return `vor ${days} Tagen`
  if (days < 30) return `vor ${Math.floor(days / 7)} Wo.`
  return `vor ${Math.floor(days / 30)} Mon.`
}

/**
 * BackupList - Compact table of available backups
 * 
 * Shows backup files with relative time, size, and restore action
 */
export function BackupList({ backups, onRestore }: BackupListProps) {
  if (backups.length === 0) {
    return (
      <div className="helper" style={{ marginTop: 8, textAlign: 'center' }}>
        Noch keine Sicherungen vorhanden.
      </div>
    )
  }

  return (
    <div className="backup-list-container">
      <table className="backup-list-table">
        <thead>
          <tr>
            <th>Datei</th>
            <th>Erstellt</th>
            <th style={{ textAlign: 'right' }}>Größe</th>
            <th style={{ textAlign: 'center', width: 44 }}></th>
          </tr>
        </thead>
        <tbody>
          {backups.map((b, i) => (
            <tr key={i}>
              <td className="backup-list-file" title={b.filePath}>
                {fileName(b.filePath)}
              </td>
              <td className="backup-list-date" title={new Date(b.mtime).toLocaleString('de-DE')}>
                {relativeTime(b.mtime)}
              </td>
              <td className="backup-list-size">
                {(b.size / 1024 / 1024).toFixed(1)} MB
              </td>
              <td className="backup-list-action">
                <button 
                  className="btn btn-icon"
                  onClick={() => onRestore(b)}
                  title="Wiederherstellen…"
                  aria-label="Wiederherstellen"
                >
                  ↺
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
