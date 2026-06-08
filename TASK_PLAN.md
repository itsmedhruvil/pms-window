# Implementation Plan

## 1. Fix "Mark Done" - Comment check with popup (TaskDetailClient.tsx)
- Remove textarea from done modal
- When clicking "Mark Done", check if comments exist for the task
- If no comments, show a popup alert "Please add a comment first" (no input box)
- User adds comment in the comment tab, then clicks Mark Done again

## 2. Discussions CRUD (Edit/Delete + Cloudinary file upload)
- Add Edit button on discussion threads (edit title/description via modal)
- Add Delete button with confirmation
- Fix file upload to use Cloudinary API instead of base64 data URLs

## 3. Excel file rendering in tasks
- When .xlsx/.xls/.csv files are uploaded to a task, render them inline using ExcelJS

## 4. SWR + Hot Reload + AJAX Data Loading
- Refactor TaskDetailClient to use SWR for fetching
- Add SWR mutation hooks for task updates
- Use AJAX polling for real-time updates
- Efficient cache invalidation patterns