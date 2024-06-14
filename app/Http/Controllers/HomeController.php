<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

/************************************
*  
*  Home 首頁
*  
*************************************/

class HomeController extends SiteController {
   
    // 首頁
    public function index(Request $request) {
    	
        return view('coming.index',$this->data);
    }
    
}
