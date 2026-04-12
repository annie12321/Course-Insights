// Annie Chen and Emily Zhu
"use strict";

var g;

function nextIfOk(resp) {
    g = resp;
    console.log('response received');
    if(resp.status === 200) {
        return resp.json();
    } else {
        throw new Error('Something went wrong on server!');
    }
}

function loginAjax() {
    let uid = $('[name=uid]').val();
    let form = document.getElementById('login_form');
    console.log('form', form);
    let form_data = new FormData(form);
    console.log('data', form_data);
    const req = new Request('/set-uid-ajax/', {method: 'POST',
                                               body: form_data});
    fetch(req)
        .then(nextIfOk)
        .then((resp) => { console.debug(resp);
                          // update page for logged-in user
                          $("#login-uid").text(uid);
                          $("#logged-in").show();
                          $("#not-logged-in").hide();
                        })
        .catch((error) => { console.error(error); });
}

document.addEventListener("DOMContentLoaded", () => {
    const hoursSlider = document.getElementById("hours-per-week");
    const hoursValue = document.getElementById("hoursValue");

    const difficultySlider = document.getElementById("difficulty");
    const difficultyValue = document.getElementById("difficultyValue");

    if (hoursSlider) {
        hoursValue.textContent = hoursSlider.value;
        hoursSlider.oninput = () => {
            hoursValue.textContent = hoursSlider.value;
        };
    }

    if (difficultySlider) {
        difficultyValue.textContent = difficultySlider.value;
        difficultySlider.oninput = () => {
            difficultyValue.textContent = difficultySlider.value;
        };
    }
});

$("#login-ajax").click(loginAjax);

console.log('main.js loaded');

