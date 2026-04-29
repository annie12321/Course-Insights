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

/**
 * Provides numberical labels for range sliders
 */
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

/**
 * Event handler for clicking on bookmark button on course page.
 */
$("#save-button").on("click", function () {
    const icon = $(this).find(".fa-bookmark");
    const [dept, num] = icon.data("course").split(" ");
    const act = icon.hasClass("fa-regular") ? "save" : "unsave";
    saveCourse(dept, num, act);
});

/**
 * Response handler for bookmarking course.
 * @param {Response} resp - response object, which includes course object and act, for
 * action, which is save or unsave.
 */
function processAction(resp) {
    console.log('response is ', resp);
    const icon = $(`[data-course="${resp.course.department} ${resp.course.course_num}"]`);
    console.log('icon has fa-bookmark class ', icon.hasClass("fa-bookmark"));

    if (resp.act === "save") {
        icon.removeClass("fa-regular").addClass("fa-solid");
    } else {
        icon.removeClass("fa-solid").addClass("fa-regular");
    }
}

/**
 * Function to save course with ajax. 
 * @param {string} dept - course department
 * @param {string} num - course number
 * @param {string} act - save or unsave, depending on the action
 */
function saveCourse(dept, num, act) {
    $.post("/saveAjax/"+dept+"/"+num+"/"+act, {dept: dept, num: num, act: act}).then(processAction);
}

$("#login-ajax").click(loginAjax);

console.log('main.js loaded');

