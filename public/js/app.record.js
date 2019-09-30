document.addEventListener('DOMContentLoaded', function () {

    String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
    };

    function download(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

    $("#load-subject").click(function(){
        $("#subject-container").attr('class','container');

        setTimeout(function(){
            $("#subject-container").html("");
        }, 2000);
        $("#welcome-screen").attr('class','d-none');
        role = 1;
    });

    $("#load-researcher").click(function(){
        $("#welcome-screen").attr('class','d-none');
        $("#title").attr('class','container');
        $("#content").attr('class','container');
        role = 0;
    })
    $("#load_experiment").click(function(e){
        e.preventDefault();
        $("#file-upload").on('change', function(){
            var file = $(this)[0].files[0];
            if (file){
                var reader = new FileReader();
                reader.readAsText(file, "UTF-8");
                reader.onload = function (evt) {
                    editor.setValue(evt.target.result,-1);
                }
                reader.onerror = function (evt) {
                    document.getElementById("editor").innerHTML = "error reading file";
                }
            }
        }).click();
    });

    $("#save_experiment").click(function(e){
        download('script.txt', editor.getValue());
    });

    var editor = ace.edit("editor");
        editor.setTheme("ace/theme/monokai");
        editor.session.setMode("ace/mode/javascript");

    var socket = new io.connect('http://localhost:3000', {path: '/connection/eeg',reconnect: true});
    var counter = 0;
    var step = 0;
    var code = "";
    var experiment = "";
    var sentences = "";
    var execution_line = 0;
    var waiting_for_trigger = false;
    // role = 0: Researcher
    // role = 1: Subject
    var role = 0;
    var audio_sound = new Audio();
    var beep_sound = new Audio('./data/beep.mp3');

    a=new AudioContext()
    function beep(vol, freq, duration){
      v=a.createOscillator()
      u=a.createGain()
      v.connect(u)
      v.frequency.value=freq
      v.type="square"
      u.connect(a.destination)
      u.gain.value=vol*0.01
      v.start(a.currentTime)
      v.stop(a.currentTime+duration*0.001)
    }
    //beep_sound.loop = true;
    socket.on('connect', function () {
      socket.on('dev', function(data){
        let connection_information = data[2];
        let total = 0;
        for (let index = 0; index<=13; index=index+1){
          total = total + connection_information[index];
        }
        let avg = total/14/4*100;
        $("#quality").text(avg);
      });
        console.log('Connected to server');
        $("#run_experiment").off('click');
        execution_line = 0;
        $("#run_experiment").click(function(e){
            e.preventDefault();
            $("#run_experiment").addClass('disabled');
            code = editor.getValue();
            // we should go until sentences.length-1 EYE WITH THIS
            sentences = code.replaceAll('\n','').split(';');
            let commands = sentences[execution_line].split('(');
            let func = commands[0];
            let args = commands[1].split(')')[0];
            let data = {
                    'command': func,
                    'args': args
            };
            if (func === "experiment"){
                console.log('Recognizing Experiment')
                experiment = args;
            }
            console.log('Sending initial command')
            socket.emit('command', data);
        });

        socket.on('beep', function(data){
            if (role)
                 // browsers limit the number of concurrent audio contexts, so you better re-use'em
                beep(100, 250, data)
        });

        socket.on('present',function(data){
            let image = "<img src='"+data+"' style='max-height:50%, width: auto;'>";
            $("#subject-container").removeClass('d-none');
            if (role)
                $("#subject-container").html(image);
        });
        socket.on('play',function(data){
            audio_sound.src=data;
            if (role)
                setTimeout(function(){
                    audio_sound.loop = false;
                    audio_sound.play();
                }, 10);
        });
        socket.on('finish', function(){
            if (role){
                $("#subject-container").html("<h3>Waiting... Please, be patient</h3>");
                setTimeout(function(){
                    $("#subject-container").html("");
                }, 2000);
            }
        });
        socket.on('error',function(){
            alert('An error in server has occurred.');
        });
        socket.on('ball',function(data){
            if (role){
                $("#subject-container").html("<div class='d-none' id='ball-container'><span class='dot' id='ball'></span></div>");
                if (data.orientation === 'manual'){
                  // JOSMAR code
                }
                else if (data.orientation === 'random'){
                    $("#subject-container").html('<canvas id="canvas" style="position: absolute; top: 0; left: 0;"></canvas>');
                    $("#ball-container").removeClass('d-none');
                    var canvas = document.getElementById('canvas');

                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;

                    var x = canvas.width / 2; //initial position
                    var y = canvas.height / 2;

                    var cxt = canvas.getContext('2d');
                    cxt.fillStyle = '#FF0000'; //color
                    var radius = 10;

                    var dx = 0;
                    var dy = 0;
                    var delta = 5; // range (from 0) of possible dx or dy change
                    var max = 15; // maximum dx or dy values
                    canvas.addEventListener("click", togglestart);

                    function togglestart() {
                        if (interval == undefined) interval = window.setInterval(animate, 1000 / 60); // 60 FPS
                        else {
                            interval = clearInterval(interval);
                            console.log(interval);
                        }
                    }

                    var interval = window.setInterval(animate, 1000 / 60);

                    function animate() {
                        var d2x = (Math.random() * delta - delta / 2); //change dx and dy by random value
                        var d2y = (Math.random() * delta - delta / 2);

                        if (Math.abs(d2x + dx) > max) // start slowing down if going too fast
                        d2x *= -1;
                        if (Math.abs(d2y + dy) > max) d2y *= -1;

                        dx += d2x;
                        dy += d2y;

                        if ((x + dx) < 0 || (x + dx) > canvas.width) // bounce off walls
                        dx *= -1;
                        if ((y + dy) < 0 || (y + dy) > canvas.height) dy *= -1;

                        x += dx;
                        y += dy;

                        cxt.beginPath(); //drawing circle
                        cxt.arc(x, y, radius, 0, 2 * Math.PI, false);
                        cxt.clearRect(0, 0, canvas.width, canvas.height); // wiping canvas
                        cxt.fill();
                    }
                }else if (data.orientation ==='bottom'){
                    // ball goes down
                    $("#ball-container").removeClass('d-none');
                    $("#ball").css('top', '1%');
                    $("#ball").css('left','50%');
                    setTimeout(function(){
                        $("#ball").animate({
                            top:'97%'
                        },
                            600,
                            function(){

                            }
                        )
                    },data.duration);
                }else if (data.orientation === 'top'){
                    // ball goes up
                    $("#ball-container").removeClass('d-none');
                    $("#ball").css('top', '97%');
                    $("#ball").css('left','50%');
                    setTimeout(function(){
                        $("#ball").animate({
                            top:'0px'
                        },
                            600,
                            function(){

                            }
                        )
                    },data.duration);
                }else if (data.orientation === 'left'){
                    // ball goes left
                    $("#ball-container").removeClass('d-none');
                    $("#ball").css('top', '50%');
                    $("#ball").css('left','97%');
                    setTimeout(function(){
                        $("#ball").animate({
                            left:'1%'
                        },
                            600,
                            function(){

                            }
                        )
                    },data.duration);
                }else if (data.orientation === 'right'){
                    // ball goes right
                    $("#ball-container").removeClass('d-none');
                    $("#ball").css('top', '50%');
                    $("#ball").css('left','1%');
                    setTimeout(function(){
                        $("#ball").animate({
                            left:'97%'
                        },
                            600,
                            function(){

                            }
                        )
                    },data.duration);
                }else{
                    console.log('Unrecognized data');
                }
            }
        });
        socket.on('clear',function(data){
            if (data === "screen"){
                console.log('Recognizing Clear Screen')
                let emptyness = "";
                $("#subject-container").html(emptyness);
            }else if (data === "audio"){
                console.log('Recognizing Clear Sound')
                audio_sound.pause();
                audio_sound.currentTime=0;
            }
        })
        socket.on('command',function(data){
            console.log(data);
            if (data === "ready" && !role){
                beep_sound.pause();
                execution_line = execution_line + 1;
                console.log(sentences[execution_line]);
                let commands = sentences[execution_line].split('(');
                console.log(commands);
                let func = commands[0];
                let args = commands[1].split(')')[0];
                let data = {
                        'command': func,
                        'args': args
                };
                if (func === "experiment"){
                    console.log('Recognizing Experiment')
                    experiment = args;
                }
                else if (func === "beep"){
                    console.log('Recognizing Beep')
                }else if (func === "present"){
                    console.log('Recognizing Presentation')

                }else if (func === "play"){
                    console.log('Recognizing Play')

                }else if (func === "clear"){
                    console.log('Recognizing Clear');
                }else if (func === "ball"){
                    console.log("Recognizing ball");
                }else if (func === "wait"){
                    if (args>0 || args.length>0){
                        console.log('waiting server response');
                    }else{
                        console.log('Recognizing Wait')
                        $("#trigger_button").removeClass('disabled');
                        waiting_for_trigger = true;
                        $("#trigger_button").off('click');
                        $("#trigger_button").click(function(e){
                            e.preventDefault();
                            socket.emit('command',{
                                "command": 'wait'
                            });
                            $("#trigger_button").addClass('disabled');
                            waiting_for_trigger = false;
                        });
                    }
                }else if (func === "finish"){
                    console.log('finished');
                    $("#run_experiment").removeClass("disabled");
                    $("#trigger_button").addClass('disabled');
                    console.log('this way');
                    socket.emit('command',{
                        "command":'finish'
                    });
                    execution_line = 0;
                }
                if (!waiting_for_trigger){
                    socket.emit('command', data);
                }
            }else{
                console.log('Either user has no right role or an error has occured while receiving command from server');
            }
        });

        socket.on('dev', function(data){

        });
        socket.on('data',function(data){

        });
        socket.on('subject-html',function(data){
            $("#subject-container").html(data);
        });
    });
}, false);