// routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const Task = require('../models/Task');

// Add new task
router.post('/add-task', async (req, res) => {
  try {
    const { task, date, status } = req.body;
    const newTask = new Task({ task, date, status });
    await newTask.save();
    res.status(201).json({ message: 'Task saved', task: newTask });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save task' });
  }
});

// Get all tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Delete a task
router.delete('/task/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Update task status
router.put('/task/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

module.exports = router;
