<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

use App\Models\Test;
/************************************
*  
*  TradingView Bot
*  
*************************************/

class TgBotController extends SiteController {
   
    // 首頁
    public function index(Request $request) {
    	
        $this->getRequest($request);
        $reponse = $this->request;


        // 判斷信號為做多或空
        if ($reponse['close'] >= $reponse['open']) {
            $reponse['type'] = "buy";
        } else {
            $reponse['type'] = "sell";
        }

        $reponse = json_encode($reponse);

        $data = Test::create([
            "data" => $reponse
        ]);

        /*
        {
        "type":"sell",
        "ticker":"{{ticker}}",
        "open":"{{open}}",
        "close":"{{close}}",
        "high":"{{high}}",
        "low":"{{low}}",
        "volume":"{{volume}}",
        "time":"{{time}}"
        }
        */


        
        
        file_get_contents("https://api.telegram.org/bot7360641960:AAHeOdSE1MmR5nJU1iiJtP0pM0-W9XEgTOU/sendMessage?chat_id=545205414&text=" . urlencode($reponse));

    }
    
}
