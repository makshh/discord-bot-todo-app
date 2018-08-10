var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var fs = require('fs');
var ftp = require('ftp');

logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
  colorize: true
});
logger.level = 'debug';

var bot = new Discord.Client({
  token: auth.token,
  autorun: true
});
var myftp = new ftp();

bot.on('ready', function (evt) {
  logger.info('Connected');
  logger.info('Logged in as: ');
  logger.info(bot.username + ' - (' + bot.id + ')');
});

function renameProperty(obj, oldName, newName) {
	if (oldName == newName) {
    return obj;
  }
  if (obj.hasOwnProperty(oldName)) {
    obj[newName] = obj[oldName];
    delete obj[oldName];
  }
  return obj;
}

var todo = {
	list: {},
  ftpConnect: function() {
    myftp.connect({
      host: 'YOUR HOST NAME',
      user: 'YOUR HOST USERNAME',
      password: 'YOUR HOST PASSWORD'
    });
  },
  readFile: function() {
    this.ftpConnect();
    myftp.get('YOUR TODO JSON FILE LOCATION', function(err, stream) {
      if (err) throw err;
      stream.once('close', function() {
        todo.list = JSON.parse(fs.readFileSync('todo.json', 'utf8'));
        myftp.end();
      });
      stream.pipe(fs.createWriteStream('todo.json'));
    });
  },
  writeFile: function(removeId) {
    if(removeId >= 0) {
      for(var i = removeId; i <= this.numberOfTasks(); i++) {
        renameProperty(this.list, i.toString(), (i - 1).toString());
      }
    }
    fs.writeFile('todo.json', JSON.stringify(todo.list), (err) => {
      if (err) console.error(err)
    });
    this.ftpConnect();
    myftp.put('todo.json', 'public_html/todo.json', function(err) {
      if (err) throw err;
      myftp.end();
    });
  },
  numberOfTasks: function() {
  	return Object.keys(this.list).length;
  },
  numberOfTasksDone: function() {
    var numberOfTasksDone = 0;
    for(var i = 0; i < this.numberOfTasks(); i++) {
      if(+this.list[i].done === 1) {
        numberOfTasksDone++;
      }
    }
    return numberOfTasksDone;
  },
  numberOfTasksNotDone: function() {
    var numberOfTasksNotDone = 0;
    for(var i = 0; i < this.numberOfTasks(); i++) {
      if(+this.list[i].done === 0) {
        numberOfTasksNotDone++;
      }
    }
    return numberOfTasksNotDone;
  },
  numberOfTasksDonePercent: function() {
    if(this.numberOfTasksDone() === 0) {
      return '0%';
    } else {
      return parseInt((this.numberOfTasksDone() / this.numberOfTasks()) * 100, 10) + '%';
    }
  },
  newTask: function(message) {
  	var numberOfTasks = this.numberOfTasks();
  	this.list[numberOfTasks] = {
  		task: message,
  		done: 0
  	};
  	this.writeFile();
  },
  editTask: function(id, message) {
    this.list[id - 1] = {
      task: message,
      done: 0
    };
    this.writeFile();
  },
  showTasks: function(start) {
  	var numberOfTasks = this.numberOfTasks();
  	var message = '';
  	for(var i = start - 1; i < start + 4; i++) {
  		if(this.list[i] === undefined) {
  			break;
  		}
  		if(this.list[i].done === 1) {
  			message += '**DONE=============================================================DONE**\n';
  			message += i + 1 + '. ' + this.list[i].task + '\n'
  			message += '**DONE=============================================================DONE**\n\n';
  		} else {
  			message += i + 1 + '. ' + this.list[i].task + '\n\n';
  		}
  	}
  	return message;
  },
  markAsDone: function(id) {
  	this.list[id - 1].done = 1;
  	this.writeFile();
  },
  unmarkAsDone: function(id) {
  	this.list[id - 1].done = 0;
  	this.writeFile();
  },
  removeTask: function(id) {
  	delete this.list[id - 1];
  	this.writeFile(id);
  },
  toRemove: false
};

todo.readFile();

bot.on('message', function (user, userID, channelID, message, evt) {

  if(user === 'Bot') {
    return;
  }

  var words = message.split(' ');
  if(words[0] === 'kill' && words[1] === 'bot') {
    bot.sendMessage({
      to: 'YOUR DISCORD CHANNEL ID',
      message: "I'm done here..."
    });
    setTimeout(function() {
      bot.disconnect();
      process.exit();
    }, 1000);
  }
  if(words[0] === 'task' && channelID === 'YOUR DISCORD CHANNEL ID') {
  	if(words[1] === 'new') {
  		var task = message.split('^^^');
  		task = task[task.length - 2];
      if(task && task.length > 5) {
    		todo.newTask(task);
    		bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: 'New task was added.'
        });
      } else {
        bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: 'Something went wrong...'
        });
      }
  	}
    if(words[1] === 'edit') {
      var task = message.split('^^^');
      task = task[task.length - 2];
      if(task && task.length > 5) {
        if(+words[2] > 0 && +words[2] <= todo.numberOfTasks()) {
          todo.editTask(+words[2], task);
          bot.sendMessage({
            to: 'YOUR DISCORD CHANNEL ID',
            message: 'Task edited'
          });
        } else {
          bot.sendMessage({
            to: 'YOUR DISCORD CHANNEL ID',
            message: 'There is no such task'
          });
        }
      } else {
        bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: 'Something went wrong'
        });
      }
    }
    if(words[1] === 'show') {
      if(+words[2] > 0 && +words[2] <= todo.numberOfTasks()) {
        var tasks = todo.showTasks(+words[2]);
        bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: tasks
        });
      } else {
        bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: 'There is no such task'
        });
      }
    }
  	if(words[1] === 'done') {
      if(+words[2] > 0 && +words[2] <= todo.numberOfTasks()) {
        if(+todo.list[+words[2] - 1].done === 1) {
          bot.sendMessage({
            to: 'YOUR DISCORD CHANNEL ID',
            message: 'This task has already been done'
          });
        } else {
          todo.markAsDone(+words[2]);
          bot.sendMessage({
            to: 'YOUR DISCORD CHANNEL ID',
            message: 'Task ' + words[2] + ' marked as done'
          });
        }
      } else {
        bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: 'There is no such task'
        });
      }
  	}
  	if(words[1] === 'undone') {
      if(+words[2] > 0 && +words[2] <= todo.numberOfTasks()) {
        if(+todo.list[+words[2] - 1].done === 0) {
          bot.sendMessage({
            to: 'YOUR DISCORD CHANNEL ID',
            message: 'This task has not already been done'
          });
        } else {
          todo.unmarkAsDone(+words[2]);
          bot.sendMessage({
            to: 'YOUR DISCORD CHANNEL ID',
            message: 'Task ' + words[2] + ' marked as undone'
          });
        }
      } else {
        bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: 'There is no such task'
        });
      }
  	}
    if(words[1] === 'delete') {
      if(+words[2] > 0 && +words[2] <= todo.numberOfTasks()) {
        bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: 'Are you sure? Say `task yes` or `task no`.'
        });
        todo.toRemove = +words[2];
      } else {
        bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: 'There is no such task'
        });
      }
    }
    if(words[1] === 'yes' && todo.toRemove === false) {
      bot.sendMessage({
        to: 'YOUR DISCORD CHANNEL ID',
        message: 'No task to delete'
      });
    }
    if(words[1] === 'yes' && todo.toRemove !== false) {
      var removeId = todo.toRemove;
      todo.removeTask(removeId);
      todo.toRemove = false;
      bot.sendMessage({
        to: 'YOUR DISCORD CHANNEL ID',
        message: 'Task ' + removeId + ' removed'
      });
    }
    if(words[1] === 'no') {
      if(todo.toRemove !== false) {
        todo.toRemove = false;
        bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: 'Task not deleted'
        });
      } else {
        bot.sendMessage({
          to: 'YOUR DISCORD CHANNEL ID',
          message: 'There is no such task'
        });
      }
    }
    if(todo.toRemove !== false && words[1] !== 'yes' && words[1] !== 'no' && words[1] !== 'delete') {
      todo.toRemove = false;
    }
    if(words[1] === 'stats') {
      var numberOfTasks = todo.numberOfTasks();
      var numberOfTasksDone = todo.numberOfTasksDone();
      var numberOfTasksNotDone = todo.numberOfTasksNotDone();
      var numberOfTasksDonePercent = todo.numberOfTasksDonePercent();
      bot.sendMessage({
        to: 'YOUR DISCORD CHANNEL ID',
        message: 'Number of tasks: ' + numberOfTasks + '\n' + 'Done: ' + numberOfTasksDone + '\n' + 'Undone: ' + numberOfTasksNotDone + '\n' + 'Percent of completed tasks: ' + numberOfTasksDonePercent
      });
    }
    if(words[1] !== 'new' && words[1] !== 'edit' && words[1] !== 'show' && words[1] !== 'done' && words[1] !== 'undone' && words[1] !== 'delete' && words[1] !== 'stats' && words[1] !== 'yes' && words[1] !== 'no') {
      bot.sendMessage({
        to: 'YOUR DISCORD CHANNEL ID',
        message: 'Wrong command'
      });
    }
  }

});
