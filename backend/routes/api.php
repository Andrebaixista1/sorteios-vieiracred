<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

use App\Http\Controllers\Api\CodeController;
use App\Http\Controllers\Api\ConfigurationController;

Route::get('configuration', [ConfigurationController::class, 'show']);
Route::post('configuration', [ConfigurationController::class, 'store']);
Route::get('codes', [CodeController::class, 'index']);
Route::get('play/summary', [CodeController::class, 'playSummary']);
Route::post('play/pop', [CodeController::class, 'playPop']);
Route::post('codes', [CodeController::class, 'store']);
Route::post('codes/reset', [CodeController::class, 'reset']);
Route::post('codes/check', [CodeController::class, 'checkToken']);
Route::post('codes/validate', [CodeController::class, 'validateCode']);
